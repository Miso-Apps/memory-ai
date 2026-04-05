"""Email service — templated email delivery for DukiAI Memory.

Sending strategy (in priority order):
    1. Gmail API  — used when GMAIL_REFRESH_TOKEN is set in config.
                    Authenticates via OAuth2, no password or app-password needed.
    2. SMTP       — fallback when GMAIL_REFRESH_TOKEN is empty and SMTP_HOST is set.
"""

import asyncio
import base64
import html
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings


def escape(value: str) -> str:
    """HTML-escape a string."""
    return html.escape(str(value), quote=False)


logger = logging.getLogger(__name__)

# Disable Gmail transport for the running process after a hard OAuth token error
# (e.g. invalid_grant) to avoid repeated failures and latency on every email send.
_GMAIL_DISABLED_FOR_PROCESS = False

# Module-level Gmail API service cache — avoids a Discovery API round-trip on
# every outgoing email.
_GMAIL_SERVICE_CACHE: dict = {}


def _is_gmail_auth_failure(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(
        token in msg
        for token in ("invalid_grant", "invalid_client", "unauthorized_client")
    )


def get_email_transport_diagnostic() -> dict:
    """Return the effective email transport readiness for diagnostics."""
    gmail_token_present = bool((settings.GMAIL_REFRESH_TOKEN or "").strip())
    gmail_client_id_present = bool((settings.GOOGLE_CLIENT_ID or "").strip())
    gmail_client_secret_present = bool((settings.GOOGLE_CLIENT_SECRET or "").strip())
    gmail_oauth_ready = (
        gmail_token_present and gmail_client_id_present and gmail_client_secret_present
    )
    smtp_host_configured = bool((settings.SMTP_HOST or "").strip())

    if gmail_oauth_ready and not _GMAIL_DISABLED_FOR_PROCESS:
        active_transport = "gmail"
    elif smtp_host_configured:
        active_transport = "smtp"
    elif settings.DEBUG:
        active_transport = "console"
    else:
        active_transport = "none"

    return {
        "gmail_oauth_ready": gmail_oauth_ready,
        "gmail_disabled_for_process": _GMAIL_DISABLED_FOR_PROCESS,
        "smtp_host_configured": smtp_host_configured,
        "transport_configured": active_transport != "none",
        "active_transport": active_transport,
    }


# ---------------------------------------------------------------------------
# Localisation helpers
# ---------------------------------------------------------------------------


def _normalize_locale(locale: str | None) -> str:
    raw = (locale or "en").strip().lower()
    if raw.startswith("vi"):
        return "vi"
    return "en"


def _text(locale: str, en: str, vi: str) -> str:
    return vi if locale == "vi" else en


def _safe_name(name: str | None, locale: str) -> str:
    fallback = _text(locale, "there", "bạn")
    cleaned = (name or "").strip()
    return escape(cleaned or fallback)


# ---------------------------------------------------------------------------
# Base email shell
# ---------------------------------------------------------------------------


def _base_template(body_html: str, preheader: str = "", locale: str = "en") -> str:
    """Wrap content in a DukiAI Memory branded email shell."""
    lang = _normalize_locale(locale)
    footer_title = _text(
        lang,
        "DukiAI Memory — Your personal memory companion",
        "DukiAI Memory — Trợ lý ký ức cá nhân của bạn",
    )
    tagline = _text(
        lang,
        "Saving is central. Forgetting is normal.",
        "Lưu giữ là trọng tâm. Quên là bình thường.",
    )

    return f"""\
<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>DukiAI Memory</title>
<style>
    :root {{ color-scheme: light dark; }}
    body {{ margin:0; padding:0; background:#F5F3F0; color:#1A1A2E; font-family:'Segoe UI',Roboto,Arial,sans-serif; }}
    .preheader {{ display:none; font-size:1px; color:#F5F3F0; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }}
    .outer {{ width:100%; padding:28px 12px; box-sizing:border-box; }}
    .container {{ max-width:560px; margin:0 auto; }}
    .brand {{ margin:0 0 14px; }}
    .brand-chip {{ display:inline-flex; align-items:center; gap:8px; background:#1A1A2E; color:#FFFFFF; border-radius:999px; padding:8px 14px; font-size:12px; font-weight:700; letter-spacing:0.4px; }}
    .brand-mark {{ display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; background:#6C63FF; color:#FFFFFF; font-size:12px; font-weight:700; }}
    .card {{ background:#FFFFFF; border:1px solid #E8E4DF; border-radius:20px; overflow:hidden; box-shadow:0 12px 40px rgba(26,26,46,0.08); }}
    .card-top {{ height:6px; background:linear-gradient(90deg,#6C63FF 0%,#A78BFA 50%,#F472B6 100%); }}
    .card-body {{ padding:28px 24px 24px; }}
    h2 {{ margin:0 0 10px; color:#1A1A2E; font-size:24px; line-height:1.3; font-weight:700; }}
    p {{ margin:0 0 12px; color:#374151; font-size:14px; line-height:1.65; }}
    .muted {{ color:#6B7280; font-size:12px; line-height:1.6; }}
    .highlight {{ color:#6C63FF; font-weight:700; }}
    .btn-wrap {{ text-align:center; margin:22px 0 10px; }}
    .btn {{
        display:inline-block; text-decoration:none; color:#FFFFFF !important;
        background:#6C63FF;
        background-image:linear-gradient(135deg,#6C63FF 0%,#A78BFA 100%);
        border:1px solid #5B52EE; border-radius:999px;
        padding:13px 28px; min-width:172px; box-sizing:border-box;
        text-align:center; font-size:14px; line-height:1.2; font-weight:800;
        letter-spacing:0.2px;
        box-shadow:0 8px 20px rgba(108,99,255,0.30), inset 0 1px 0 rgba(255,255,255,0.20);
    }}
    .btn:visited {{ color:#FFFFFF !important; }}
    .divider {{ border:none; border-top:1px solid #E5E7EB; margin:16px 0; }}
    .footer {{ text-align:center; padding:16px 6px 4px; color:#6B7280; font-size:11px; line-height:1.7; }}
    @media (max-width: 480px) {{
        .card-body {{ padding:22px 18px 20px; }}
        h2 {{ font-size:21px; }}
        .btn {{ width:100%; min-width:0; box-sizing:border-box; }}
    }}
    @media (prefers-color-scheme: dark) {{
        body {{ background:#0F0F1A !important; color:#E2E8F0 !important; }}
        .brand-chip {{ background:#1E1E3A !important; }}
        .card {{ background:#1A1A2E !important; border-color:#2D2D4E !important; box-shadow:none !important; }}
        h2 {{ color:#F8FAFC !important; }}
        p, li {{ color:#CBD5E1 !important; }}
        .muted {{ color:#94A3B8 !important; }}
        .btn {{
            background:#7C74FF !important;
            background-image:linear-gradient(135deg,#7C74FF 0%,#B49AFF 100%) !important;
            border-color:#6C63FF !important;
        }}
        .footer {{ color:#94A3B8 !important; }}
    }}
</style>
</head>
<body>
    <div class="preheader">{escape(preheader)}</div>
    <div class="outer">
      <div class="container">
        <div class="brand">
          <span class="brand-chip"><span class="brand-mark">M</span> DukiAI Memory</span>
        </div>
        <div class="card">
          <div class="card-top"></div>
          <div class="card-body">
            {body_html}
          </div>
        </div>
        <div class="footer">
          <p>{footer_title}</p>
          <p><em>{tagline}</em></p>
        </div>
      </div>
    </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Transport layer
# ---------------------------------------------------------------------------


def _build_mime(to: str, subject: str, html_content: str, sender: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(html_content, "html"))
    return msg


def _get_gmail_service():
    """Return a cached Gmail API service, built once per process."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    cache_key = (
        settings.GOOGLE_CLIENT_ID,
        settings.GMAIL_REFRESH_TOKEN[:8] if settings.GMAIL_REFRESH_TOKEN else "",
    )
    if cache_key not in _GMAIL_SERVICE_CACHE:
        creds = Credentials(
            token=None,
            refresh_token=settings.GMAIL_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/gmail.send"],
        )
        _GMAIL_SERVICE_CACHE[cache_key] = build(
            "gmail", "v1", credentials=creds, cache_discovery=True
        )
    return _GMAIL_SERVICE_CACHE[cache_key]


def _send_via_gmail_api(to: str, subject: str, html_content: str) -> None:
    service = _get_gmail_service()
    msg = _build_mime(to, subject, html_content, settings.SMTP_FROM)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()


def _send_via_smtp(to: str, subject: str, html_content: str) -> None:
    msg = _build_mime(to, subject, html_content, settings.SMTP_FROM)
    timeout_seconds = 15

    def _send_on_port(port: int) -> None:
        if int(port) == 465:
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST, port, timeout=timeout_seconds
            ) as server:
                server.ehlo()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(
                settings.SMTP_HOST, port, timeout=timeout_seconds
            ) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

    primary_port = int(settings.SMTP_PORT)
    fallback_port = 465 if primary_port == 587 else 587 if primary_port == 465 else None

    try:
        _send_on_port(primary_port)
    except TimeoutError:
        if fallback_port is None:
            raise
        logger.warning(
            "SMTP timed out on port %s; retrying with port %s",
            primary_port,
            fallback_port,
        )
        _send_on_port(fallback_port)


def _send_via_console(to: str, subject: str, html_content: str) -> None:
    """Dev-mode fallback: print email to the console instead of sending.

    Extracts href links from anchor tags so the developer can copy the
    verification URL directly from the terminal output.
    """
    import re
    links = re.findall(r'href=["\']([^"\']+)["\']', html_content)
    # Filter out mailto: and javascript: hrefs
    links = [lnk for lnk in links if lnk.startswith("http")]

    border = "=" * 70
    logger.info(
        "\n%s\n📧  [DEV EMAIL — not sent] To: %s\n    Subject: %s\n%s\n"
        "    %s\n%s\n",
        border,
        to,
        subject,
        border,
        "\n    ".join(links) if links else "(no links found)",
        border,
    )


def _send_email(to: str, subject: str, html_content: str) -> None:
    """Dispatch to Gmail API, SMTP, or console (DEBUG) based on configuration."""
    global _GMAIL_DISABLED_FOR_PROCESS

    transport = get_email_transport_diagnostic()

    if transport["gmail_oauth_ready"] and not _GMAIL_DISABLED_FOR_PROCESS:
        try:
            _send_via_gmail_api(to, subject, html_content)
            return
        except ImportError:
            logger.warning("google packages not installed; falling back to SMTP")
        except Exception as gmail_err:
            if _is_gmail_auth_failure(gmail_err):
                _GMAIL_DISABLED_FOR_PROCESS = True
                _GMAIL_SERVICE_CACHE.clear()
                logger.error(
                    "Gmail API auth failed (%s); disabling Gmail API for this process "
                    "and falling back to SMTP. Regenerate GMAIL_REFRESH_TOKEN.",
                    gmail_err,
                )
            else:
                logger.warning("Gmail API failed (%s); falling back to SMTP", gmail_err)

    if transport["smtp_host_configured"]:
        _send_via_smtp(to, subject, html_content)
        return

    # In DEBUG mode fall back to console logging so development works without
    # a real email transport configured.
    if settings.DEBUG:
        _send_via_console(to, subject, html_content)
        return

    raise RuntimeError(
        "No email transport configured. Set Gmail OAuth config "
        "(GMAIL_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) or SMTP_HOST."
    )


async def send_email(to: str, subject: str, html_content: str) -> None:
    """Send an email without blocking the event loop."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_email, to, subject, html_content)
    logger.info("Email sent to %s: %s", to, subject)


# ---------------------------------------------------------------------------
# Template builders
# ---------------------------------------------------------------------------


async def send_verification_email(
    email: str,
    token: str,
    name: str | None = None,
    locale: str | None = None,
) -> None:
    """Send email address verification link (24-hour expiry)."""
    lang = _normalize_locale(locale)
    verify_url = f"{settings.BACKEND_URL}/auth/verify-email?token={token}"
    display_name = _safe_name(name, lang)

    title = _text(lang, "Verify your email", "Xác minh địa chỉ email của bạn")
    greeting = _text(lang, "Hi", "Xin chào")
    intro = _text(
        lang,
        "Thanks for signing up! Click the button below to verify your email address and activate your DukiAI Memory account.",
        "Cảm ơn bạn đã đăng ký! Nhấn vào nút bên dưới để xác minh địa chỉ email và kích hoạt tài khoản DukiAI Memory của bạn.",
    )
    cta = _text(lang, "Verify Email", "Xác minh email")
    expiry = _text(
        lang,
        "This link expires in 24 hours. If you did not create a DukiAI Memory account, you can safely ignore this email.",
        "Liên kết này sẽ hết hạn sau 24 giờ. Nếu bạn không tạo tài khoản DukiAI Memory, bạn có thể bỏ qua email này.",
    )

    body = f"""\
<h2>{title}</h2>
<p>{greeting} {display_name},</p>
<p>{intro}</p>
<div class="btn-wrap">
    <a href="{verify_url}" class="btn">{cta}</a>
</div>
<p class="muted">{expiry}</p>"""

    html_content = _base_template(
        body,
        preheader=_text(
            lang, "Confirm your email to get started", "Xác nhận email để bắt đầu"
        ),
        locale=lang,
    )
    subject = _text(
        lang, "Verify your DukiAI Memory email", "Xác minh email DukiAI Memory của bạn"
    )
    await send_email(email, subject, html_content)


async def send_otp_email(
    to_email: str,
    code: str,
    user_name: str | None = None,
    locale: str | None = None,
) -> None:
    """Send a 6-digit OTP verification email.

    The code is displayed in a large, visually prominent box.
    No clickable button or link — the user types the code into the app.
    """
    lang = _normalize_locale(locale)
    name = _safe_name(user_name, lang)

    subject = _text(
        lang,
        f"Your DukiAI Memory verification code: {code}",
        f"Mã xác nhận DukiAI Memory của bạn: {code}",
    )

    greeting = _text(lang, f"Hi {name},", f"Chào {name},")
    intro = _text(
        lang,
        "Your verification code is:",
        "Mã xác nhận của bạn là:",
    )
    expiry_note = _text(
        lang,
        "This code expires in <strong>10 minutes</strong>. Do not share it with anyone.",
        "Mã này hết hạn sau <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.",
    )
    ignore_note = _text(
        lang,
        "If you didn't request this, you can safely ignore this email.",
        "Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này.",
    )

    body_html = f"""\
<p style="margin:0 0 12px;color:#374151;font-size:15px;">{greeting}</p>
<p style="margin:0 0 20px;color:#374151;font-size:15px;">{intro}</p>
<div style="text-align:center;margin:24px 0;">
  <div style="display:inline-block;background:#F5F3FF;border:2px solid #DDD6FE;
              border-radius:16px;padding:20px 36px;">
    <span style="font-family:'Courier New',Courier,monospace;font-size:42px;
                 font-weight:900;letter-spacing:12px;color:#6C63FF;
                 display:inline-block;min-width:220px;text-align:center;">
      {escape(code)}
    </span>
  </div>
</div>
<p style="margin:16px 0 12px;color:#374151;font-size:14px;">{expiry_note}</p>
<p style="margin:0;color:#9CA3AF;font-size:13px;font-style:italic;">{ignore_note}</p>
"""

    preheader = _text(
        lang,
        f"Your code is {code} — expires in 10 minutes",
        f"Mã của bạn là {code} — hết hạn sau 10 phút",
    )
    html = _base_template(body_html, preheader=preheader, locale=lang)
    await send_email(to_email, subject, html)


async def send_welcome_email(
    email: str,
    name: str | None = None,
    locale: str | None = None,
) -> None:
    """Send a welcome email after registration or email verification."""
    lang = _normalize_locale(locale)
    display_name = _safe_name(name, lang)

    title = _text(lang, "Welcome to DukiAI Memory", "Chào mừng đến với DukiAI Memory")
    greeting = _text(lang, "Hi", "Xin chào")
    intro = _text(
        lang,
        "Your account is ready. Start capturing memories — thoughts, voice notes, links, and photos — and DukiAI Memory will help you recall what matters when it matters.",
        "Tài khoản của bạn đã sẵn sàng. Bắt đầu lưu ký ức — suy nghĩ, ghi âm, liên kết và ảnh — và DukiAI Memory sẽ giúp bạn nhớ lại những điều quan trọng khi cần.",
    )
    tagline = _text(
        lang,
        '"Saving is central. Forgetting is normal."',
        '"Lưu giữ là trọng tâm. Quên là bình thường."',
    )

    body = f"""\
<h2>{title}</h2>
<p>{greeting} {display_name},</p>
<p>{intro}</p>
<p class="muted">{tagline}</p>"""

    html_content = _base_template(
        body,
        preheader=_text(
            lang, "Your memory companion is ready", "Trợ lý ký ức của bạn đã sẵn sàng"
        ),
        locale=lang,
    )
    subject = _text(lang, "Welcome to DukiAI Memory", "Chào mừng đến với DukiAI Memory")
    await send_email(email, subject, html_content)
