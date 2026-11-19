"""Buyer / seller accounts: username + password, with an email OTP on sign-up and on every login.

Flow
  Sign up : POST register/      {role, username, email, password, full_name, phone, shop_name?}
            -> OTP emailed -> POST verify-signup/ {email, role, otp} -> token
  Login   : POST login/         {role, username (or email), password}
            -> OTP emailed -> POST verify-login/  {email, role, otp} -> token
  Forgot  : POST forgot-password/ {email, role} -> OTP -> POST reset-password/ {email, role, otp, new_password}
The same email may own one buyer account and one seller account (separate usernames and passwords).
"""
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import EmailOTP, Profile

User = get_user_model()
ROLES = (Profile.ROLE_BUYER, Profile.ROLE_SELLER)
SUBJECTS = {
    "signup": "Verify your Vetri Shopping Hall account",
    "login": "Your Vetri Shopping Hall login OTP",
    "reset": "Reset your Vetri Shopping Hall password",
}
INTROS = {
    "signup": "Welcome to Vetri Shopping Hall! Use this code to verify your email and activate your account",
    "login": "Use this code to finish logging in",
    "reset": "Use this code to reset your password",
}


# ---------------- helpers ----------------
def _err(message, code=400, **extra):
    return Response({"detail": message, **extra}, status=code)


def _role(request):
    role = str(request.data.get("role") or Profile.ROLE_BUYER).strip().lower()
    return role if role in ROLES else None


def _email(value):
    email = str(value or "").strip().lower()
    validate_email(email)
    return email


def _find_user(email, role):
    return (User.objects.filter(email__iexact=email, profile__role=role)
            .select_related("profile").order_by("-is_active", "-id").first())


def user_data(user):
    p, _ = Profile.objects.get_or_create(user=user)
    data = {"id": user.id, "username": user.username, "email": user.email, "full_name": p.full_name,
            "phone": p.phone, "role": p.role}
    if p.is_seller:
        data.update({"shop_name": p.shop_name, "shop_description": p.shop_description, "gstin": p.gstin,
                     "is_approved": p.is_approved})
    return data


def _send_otp(email, role, purpose):
    """Create a fresh OTP and email it. Returns a Response on error, otherwise None."""
    pending = EmailOTP.objects.filter(email=email, role=role, purpose=purpose, is_used=False)
    last = pending.first()
    if last:
        wait = settings.OTP_RESEND_SECONDS - (timezone.now() - last.created_at).total_seconds()
        if wait > 0:
            return _err(f"Please wait {int(wait) + 1} seconds before requesting a new OTP.", 429)
    pending.update(is_used=True)  # old codes stop working
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailOTP.objects.create(email=email, role=role, purpose=purpose, code=code)
    message = (
        f"Vanakkam!\n\n{INTROS[purpose]}:\n\n    {code}\n\n"
        f"It is valid for {settings.OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.\n"
        "If you did not request this, you can ignore this email.\n\n- Team Vetri Shopping Hall"
    )
    try:
        send_mail(SUBJECTS[purpose], message, settings.DEFAULT_FROM_EMAIL, [email])
    except Exception as exc:  # e.g. wrong Resend key / unverified sender domain
        return _err(f"Could not send the OTP email: {exc}", 502)
    return None


def _check_otp(email, role, purpose, code):
    """Returns (ok, error_response)."""
    otp = EmailOTP.objects.filter(email=email, role=role, purpose=purpose, is_used=False).first()
    if not otp:
        return False, _err("No active OTP. Please request a new one.")
    if otp.is_expired() or otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        msg = "OTP expired." if otp.is_expired() else "Too many wrong attempts."
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        return False, _err(f"{msg} Please request a new one.")
    if not secrets.compare_digest(otp.code, str(code or "").strip()):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        return False, _err(f"Incorrect OTP. {settings.OTP_MAX_ATTEMPTS - otp.attempts} attempt(s) left.")
    otp.is_used = True
    otp.save(update_fields=["is_used"])
    return True, None


def _otp_sent(email, purpose, **extra):
    return Response({"detail": f"OTP sent to {email}", "email": email, "purpose": purpose,
                     "expires_in": settings.OTP_EXPIRY_MINUTES * 60,
                     "resend_in": settings.OTP_RESEND_SECONDS, **extra})


def _login_response(user, **extra):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": user_data(user), **extra})


# ---------------- sign up ----------------
@api_view(["POST"])
def register(request):
    role = _role(request)
    if not role:
        return _err("Choose Buyer or Seller.")
    d = request.data
    username = str(d.get("username") or "").strip()
    password = str(d.get("password") or "")
    full_name = str(d.get("full_name") or "").strip()[:120]
    phone = "".join(ch for ch in str(d.get("phone") or "") if ch.isdigit())[:15]
    shop_name = str(d.get("shop_name") or "").strip()[:120]
    try:
        email = _email(d.get("email"))
    except ValidationError:
        return _err("Please enter a valid email address.")
    if len(username) < 3 or len(username) > 150 or not all(ch.isalnum() or ch in "._-" for ch in username):
        return _err("Username must be at least 3 characters: letters, numbers, . _ or - only.")
    if not full_name:
        return _err("Please enter your full name.")
    if role == Profile.ROLE_SELLER and not shop_name:
        return _err("Please enter your shop name.")

    # an unfinished sign-up (email never verified) may be replaced by a new attempt
    stale = User.objects.filter(is_active=False, profile__email_verified=False).filter(
        Q(username__iexact=username) | Q(email__iexact=email, profile__role=role))
    stale_ids = list(stale.values_list("id", flat=True))
    if User.objects.filter(username__iexact=username).exclude(id__in=stale_ids).exists():
        return _err("This username is already taken.")
    existing = _find_user(email, role)
    if existing and existing.id not in stale_ids:
        return _err(f"A {role} account with this email already exists. Please login - or tap "
                    "'Forgot password?' on the login screen if you never set a password.")

    try:
        validate_password(password, User(username=username, email=email))
    except ValidationError as exc:
        return _err(" ".join(exc.messages))

    with transaction.atomic():
        User.objects.filter(id__in=stale_ids).delete()
        user = User(username=username, email=email, is_active=False)
        user.set_password(password)
        user.save()
        Profile.objects.create(user=user, role=role, full_name=full_name, phone=phone, shop_name=shop_name)
    error = _send_otp(email, role, "signup")
    return error or _otp_sent(email, "signup", role=role)


@api_view(["POST"])
def verify_signup(request):
    role = _role(request)
    try:
        email = _email(request.data.get("email"))
    except ValidationError:
        return _err("Invalid email.")
    user = _find_user(email, role)
    if not user:
        return _err("Account not found. Please sign up again.")
    ok, error = _check_otp(email, role, "signup", request.data.get("otp"))
    if not ok:
        return error
    user.is_active = True
    user.save(update_fields=["is_active"])
    Profile.objects.filter(user=user).update(email_verified=True)
    return _login_response(user, is_new_user=True)


# ---------------- login ----------------
@api_view(["POST"])
def login(request):
    role = _role(request)
    if not role:
        return _err("Choose Buyer or Seller.")
    identifier = str(request.data.get("username") or "").strip()
    password = str(request.data.get("password") or "")
    if not identifier or not password:
        return _err("Enter your username (or email) and password.")

    qs = User.objects.filter(profile__role=role).select_related("profile")
    user = qs.filter(username__iexact=identifier).first() or (
        qs.filter(email__iexact=identifier).order_by("-is_active", "-id").first())
    if not user or not user.has_usable_password() or not user.check_password(password):
        hint = "" if user else f" No {role} account was found - check the Buyer/Seller tab or sign up."
        return _err("Wrong username or password." + hint, 401)

    if not user.is_active:
        if not user.profile.email_verified:  # signed up but never entered the OTP
            error = _send_otp(user.email, role, "signup")
            return error or _otp_sent(user.email, "signup", role=role,
                                      message="Please verify your email first. We sent you a new OTP.")
        return _err("This account is blocked. Contact support.", 403)

    error = _send_otp(user.email, role, "login")
    return error or _otp_sent(user.email, "login", role=role)


@api_view(["POST"])
def verify_login(request):
    role = _role(request)
    try:
        email = _email(request.data.get("email"))
    except ValidationError:
        return _err("Invalid email.")
    user = _find_user(email, role)
    if not user or not user.is_active:
        return _err("Account not found.")
    ok, error = _check_otp(email, role, "login", request.data.get("otp"))
    if not ok:
        return error
    return _login_response(user)


@api_view(["POST"])
def resend_otp(request):
    """POST {email, role, purpose}. Only re-sends when an OTP of that kind was issued in the last 15 min
    (so a login OTP can only be re-sent after the correct password was entered)."""
    role = _role(request)
    purpose = request.data.get("purpose")
    if purpose not in SUBJECTS:
        return _err("Invalid request.")
    try:
        email = _email(request.data.get("email"))
    except ValidationError:
        return _err("Invalid email.")
    recent = EmailOTP.objects.filter(email=email, role=role, purpose=purpose,
                                     created_at__gte=timezone.now() - timedelta(minutes=15)).exists()
    if not recent or not _find_user(email, role):
        return _err("Please start again.")
    error = _send_otp(email, role, purpose)
    return error or _otp_sent(email, purpose, role=role)


# ---------------- forgot password ----------------
@api_view(["POST"])
def forgot_password(request):
    role = _role(request)
    try:
        email = _email(request.data.get("email"))
    except ValidationError:
        return _err("Please enter a valid email address.")
    user = _find_user(email, role)
    if user and (user.is_active or not user.profile.email_verified):
        error = _send_otp(email, role, "reset")
        if error:
            return error
    # same answer whether or not the account exists
    return _otp_sent(email, "reset", role=role)


@api_view(["POST"])
def reset_password(request):
    role = _role(request)
    try:
        email = _email(request.data.get("email"))
    except ValidationError:
        return _err("Invalid email.")
    user = _find_user(email, role)
    if not user:
        return _err("No active OTP. Please request a new one.")
    password = str(request.data.get("new_password") or "")
    try:
        validate_password(password, user)
    except ValidationError as exc:
        return _err(" ".join(exc.messages))
    ok, error = _check_otp(email, role, "reset", request.data.get("otp"))
    if not ok:
        return error
    user.set_password(password)
    user.is_active = True  # the OTP proves they own the email
    user.save()
    Profile.objects.filter(user=user).update(email_verified=True)
    Token.objects.filter(user=user).delete()  # log out other devices
    return Response({"detail": "Password changed. Please login with your new password."})


# ---------------- profile ----------------
@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def me(request):
    """GET: my profile.  PUT {full_name, phone, shop_name, shop_description, gstin}: update."""
    if request.method == "PUT":
        p, _ = Profile.objects.get_or_create(user=request.user)
        d = request.data
        p.full_name = str(d.get("full_name", p.full_name))[:120]
        p.phone = "".join(ch for ch in str(d.get("phone", p.phone)) if ch.isdigit())[:15]
        if p.is_seller:
            p.shop_name = str(d.get("shop_name", p.shop_name)).strip()[:120] or p.shop_name
            p.shop_description = str(d.get("shop_description", p.shop_description))[:2000]
            p.gstin = str(d.get("gstin", p.gstin)).strip()[:20]
        p.save()
    return Response(user_data(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """POST {old_password, new_password}"""
    user = request.user
    if user.has_usable_password() and not user.check_password(str(request.data.get("old_password") or "")):
        return _err("Current password is wrong.")
    new = str(request.data.get("new_password") or "")
    try:
        validate_password(new, user)
    except ValidationError as exc:
        return _err(" ".join(exc.messages))
    user.set_password(new)
    user.save()
    return Response({"detail": "Password changed."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"detail": "Logged out"})
