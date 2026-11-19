import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import EmailOTP, Profile

User = get_user_model()


def _user_data(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return {"id": user.id, "email": user.email, "full_name": profile.full_name, "phone": profile.phone}


@api_view(["POST"])
def send_otp(request):
    """Step 1: POST {email} -> a 6-digit OTP is emailed (or printed in the terminal)."""
    email = (request.data.get("email") or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return Response({"detail": "Please enter a valid email address."}, status=400)

    last = EmailOTP.objects.filter(email=email).first()
    if last and not last.is_used:
        wait = settings.OTP_RESEND_SECONDS - (timezone.now() - last.created_at).total_seconds()
        if wait > 0:
            return Response({"detail": f"Please wait {int(wait) + 1} seconds before requesting a new OTP."},
                            status=429)

    EmailOTP.objects.filter(email=email, is_used=False).update(is_used=True)  # old codes stop working
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailOTP.objects.create(email=email, code=code)

    message = (
        f"Vanakkam!\n\nYour Vetri Shopping Hall login OTP is: {code}\n\n"
        f"It is valid for {settings.OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.\n\n"
        "- Team Vetri Shopping Hall"
    )
    try:
        send_mail("Your Vetri Shopping Hall login OTP", message, settings.DEFAULT_FROM_EMAIL, [email])
    except Exception as exc:  # e.g. wrong Gmail app password
        return Response({"detail": f"Could not send email: {exc}"}, status=500)

    return Response({
        "detail": f"OTP sent to {email}",
        "expires_in": settings.OTP_EXPIRY_MINUTES * 60,
        "resend_in": settings.OTP_RESEND_SECONDS,
    })


@api_view(["POST"])
def verify_otp(request):
    """Step 2: POST {email, otp} -> returns auth token + user. Creates the account on first login."""
    email = (request.data.get("email") or "").strip().lower()
    code = (request.data.get("otp") or "").strip()

    otp = EmailOTP.objects.filter(email=email, is_used=False).first()
    if not otp:
        return Response({"detail": "No active OTP. Please request a new one."}, status=400)
    if otp.is_expired():
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        return Response({"detail": "OTP expired. Please request a new one."}, status=400)
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        return Response({"detail": "Too many wrong attempts. Please request a new OTP."}, status=400)
    if not secrets.compare_digest(otp.code, code):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        left = settings.OTP_MAX_ATTEMPTS - otp.attempts
        return Response({"detail": f"Incorrect OTP. {left} attempt(s) left."}, status=400)

    otp.is_used = True
    otp.save(update_fields=["is_used"])

    user = User.objects.filter(email__iexact=email).first()
    is_new = user is None
    if is_new:
        user = User.objects.create(username=email[:150], email=email)
        user.set_unusable_password()
        user.save()
    if not user.is_active:
        return Response({"detail": "This account is blocked. Contact support."}, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "is_new_user": is_new, "user": _user_data(user)})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def me(request):
    """GET: my profile.  PUT {full_name, phone}: update profile."""
    if request.method == "PUT":
        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.full_name = request.data.get("full_name", profile.full_name)[:120]
        profile.phone = request.data.get("phone", profile.phone)[:15]
        profile.save()
    return Response(_user_data(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"detail": "Logged out"})
