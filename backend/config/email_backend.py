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
