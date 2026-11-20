"""Django email backend that sends through the Resend HTTPS API.

Render's free plan blocks SMTP ports, so Gmail SMTP cannot be used there. Resend works over HTTPS (port 443).
Settings: RESEND_API_KEY, and DEFAULT_FROM_EMAIL (must be on a domain verified in Resend; the test sender
onboarding@resend.dev can only email the address that owns the Resend account).
"""
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

log = logging.getLogger(__name__)
RESEND_URL = "https://api.resend.com/emails"


class ResendError(Exception):
    pass


class ResendEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            try:
                self._send(message)
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
                log.exception("Resend: could not send email to %s", message.to)
        return sent

    def _send(self, message):
        payload = {
            "from": message.from_email or settings.DEFAULT_FROM_EMAIL,
            "to": list(message.to),
            "subject": message.subject,
            "text": message.body,
        }
        if message.cc:
            payload["cc"] = list(message.cc)
        if message.bcc:
            payload["bcc"] = list(message.bcc)
        if message.reply_to:
            payload["reply_to"] = list(message.reply_to)
        for content, mimetype in getattr(message, "alternatives", None) or []:
            if mimetype == "text/html":
                payload["html"] = content

        request = urllib.request.Request(
            RESEND_URL,
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "django-resend-backend/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read()).get("message")
            except Exception:
                detail = None
            raise ResendError(detail or f"Resend API error {exc.code}") from None
        except urllib.error.URLError as exc:
            raise ResendError(f"Could not reach Resend: {exc.reason}") from None


# ---------------------------------------------------------------------------------------------------------
# SendGrid (HTTPS API, works on Render). Unlike Resend's test mode it can email ANY address, as long as the
# "from" address is a verified Single Sender (SendGrid -> Settings -> Sender Authentication).
SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"


def _split_address(value):
    """'Vetri <a@b.com>' -> {'email': 'a@b.com', 'name': 'Vetri'}"""
    from email.utils import parseaddr
    name, addr = parseaddr(value)
    return {"email": addr, **({"name": name} if name else {})}


class SendGridEmailBackend(ResendEmailBackend):
    def _send(self, message):
        personalization = {"to": [_split_address(a) for a in message.to]}
        if message.cc:
            personalization["cc"] = [_split_address(a) for a in message.cc]
        if message.bcc:
            personalization["bcc"] = [_split_address(a) for a in message.bcc]
        content = [{"type": "text/plain", "value": message.body or " "}]
        for body, mimetype in getattr(message, "alternatives", None) or []:
            if mimetype == "text/html":
                content.append({"type": "text/html", "value": body})
        payload = {
            "personalizations": [personalization],
            "from": _split_address(message.from_email or settings.DEFAULT_FROM_EMAIL),
            "subject": message.subject,
            "content": content,
        }
        if message.reply_to:
            payload["reply_to"] = _split_address(message.reply_to[0])

        request = urllib.request.Request(
            SENDGRID_URL,
            data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20):
                return True
        except urllib.error.HTTPError as exc:
            try:
                errors = json.loads(exc.read()).get("errors") or []
                detail = "; ".join(e.get("message", "") for e in errors)
            except Exception:
                detail = None
            raise ResendError(detail or f"SendGrid API error {exc.code}") from None
        except urllib.error.URLError as exc:
            raise ResendError(f"Could not reach SendGrid: {exc.reason}") from None


# ---------------------------------------------------------------------------------------------------------
# Brevo (HTTPS API, works on Render's free plan; free ~300 emails/day). Needs an API key (starts "xkeysib-",
# NOT the "xsmtpsib-" SMTP key) and a sender verified in Brevo -> Senders.
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class BrevoEmailBackend(ResendEmailBackend):
    def _send(self, message):
        def people(addrs):
            return [_split_address(a) for a in addrs]

        payload = {
            "sender": _split_address(message.from_email or settings.DEFAULT_FROM_EMAIL),
            "to": people(message.to),
            "subject": message.subject,
            "textContent": message.body or " ",
        }
        if message.cc:
            payload["cc"] = people(message.cc)
        if message.bcc:
            payload["bcc"] = people(message.bcc)
        if message.reply_to:
            payload["replyTo"] = _split_address(message.reply_to[0])
        for body, mimetype in getattr(message, "alternatives", None) or []:
            if mimetype == "text/html":
                payload["htmlContent"] = body

        request = urllib.request.Request(
            BREVO_URL,
            data=json.dumps(payload).encode(),
            headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json",
                     "accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read()).get("message")
            except Exception:
                detail = None
            raise ResendError(detail or f"Brevo API error {exc.code}") from None
        except urllib.error.URLError as exc:
            raise ResendError(f"Could not reach Brevo: {exc.reason}") from None
