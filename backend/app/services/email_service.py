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
    body {{ margin:0; padding:0; background:#FBF7F2; color:#2C1810; font-family:'Segoe UI',Roboto,Arial,sans-serif; }}
    .preheader {{ display:none; font-size:1px; color:#FBF7F2; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }}
    .outer {{ width:100%; padding:28px 12px; box-sizing:border-box; }}
    .container {{ max-width:560px; margin:0 auto; }}
    .brand {{ margin:0 0 14px; }}
    .brand-chip {{ display:inline-flex; align-items:center; gap:8px; background:#2C1810; color:#FFF8F2; border-radius:999px; padding:8px 14px; font-size:12px; font-weight:700; letter-spacing:0.4px; }}
    .brand-logo {{ display:inline-block; vertical-align:middle; line-height:0; }}
    .code-wrap {{ text-align:center; margin:28px 0 20px; }}
    .code-box {{ display:inline-block; background:linear-gradient(160deg,#FFF3E8 0%,#FFE5CB 100%); border:2px solid #E07840; border-radius:20px; padding:20px 40px; box-shadow:0 8px 24px rgba(194,96,10,0.12); }}
    .code-label {{ display:block; font-size:10px; text-transform:uppercase; letter-spacing:2.5px; color:#C2600A; font-weight:700; margin-bottom:10px; }}
    .code-digits {{ display:block; font-family:'Courier New',Courier,monospace; font-size:44px; font-weight:900; letter-spacing:12px; color:#8B3A00; text-align:center; min-width:220px; }}
    .card {{ background:#FFFFFF; border:1px solid #E8DDD0; border-radius:20px; overflow:hidden; box-shadow:0 12px 40px rgba(44,24,16,0.08); }}
    .card-top {{ height:6px; background:linear-gradient(90deg,#C2600A 0%,#E07840 60%,#F5A870 100%); }}
    .card-body {{ padding:28px 24px 24px; }}
    h2 {{ margin:0 0 10px; color:#2C1810; font-size:24px; line-height:1.3; font-weight:700; }}
    p {{ margin:0 0 12px; color:#5A4035; font-size:14px; line-height:1.65; }}
    .muted {{ color:#8B5E3C; font-size:12px; line-height:1.6; }}
    .highlight {{ color:#C2600A; font-weight:700; }}
    .btn-wrap {{ text-align:center; margin:22px 0 10px; }}
    .btn {{
        display:inline-block; text-decoration:none; color:#FFF8F2 !important;
        background:#C2600A;
        background-image:linear-gradient(135deg,#C2600A 0%,#E07840 100%);
        border:1px solid #A84E08; border-radius:999px;
        padding:13px 28px; min-width:172px; box-sizing:border-box;
        text-align:center; font-size:14px; line-height:1.2; font-weight:800;
        letter-spacing:0.2px;
        box-shadow:0 8px 20px rgba(194,96,10,0.30), inset 0 1px 0 rgba(255,255,255,0.20);
    }}
    .btn:visited {{ color:#FFF8F2 !important; }}
    .divider {{ border:none; border-top:1px solid #E8DDD0; margin:16px 0; }}
    .footer {{ text-align:center; padding:16px 6px 4px; color:#8B5E3C; font-size:11px; line-height:1.7; }}
    @media (max-width: 480px) {{
        .card-body {{ padding:22px 18px 20px; }}
        h2 {{ font-size:21px; }}
        .btn {{ width:100%; min-width:0; box-sizing:border-box; }}
    }}
    @media (prefers-color-scheme: dark) {{
        body {{ background:#12100E !important; color:#F5EDE5 !important; }}
        .brand-chip {{ background:#2C1810 !important; color:#FFF8F2 !important; }}
        .card {{ background:#1C1410 !important; border-color:#3A2018 !important; box-shadow:none !important; }}
        h2 {{ color:#FDF7F0 !important; }}
        p, li {{ color:#E8D8CC !important; }}
        .muted {{ color:#B89080 !important; }}
        .btn {{
            background:#D97520 !important;
            background-image:linear-gradient(135deg,#D97520 0%,#F59A50 100%) !important;
            border-color:#C2600A !important;
            color:#FFF8F2 !important;
        }}
        .footer {{ color:#B89080 !important; }}
        .code-box {{ background:linear-gradient(160deg,#3A1E08 0%,#2A1404 100%) !important; border-color:#C2600A !important; box-shadow:none !important; }}
        .code-label {{ color:#E07840 !important; }}
        .code-digits {{ color:#F5A870 !important; }}
    }}
</style>
</head>
<body>
    <div class="preheader">{escape(preheader)}</div>
    <div class="outer">
      <div class="container">
        <div class="brand">
          <span class="brand-chip"><span class="brand-logo"><svg width="24" height="24" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#C2600A"/><rect x="5.2" y="9.2" width="29.6" height="20" rx="10" fill="none" stroke="#FFF8F2" stroke-width="2.2"/><rect x="19.1" y="11.2" width="1.8" height="13.2" rx="2" fill="#FFF8F2" opacity="0.58"/><rect x="10.4" y="19.2" width="8.8" height="1.8" rx="2" fill="#FFF8F2" opacity="0.9" transform="rotate(35,14.8,20.1)"/><rect x="20.8" y="19.2" width="8.8" height="1.8" rx="2" fill="#FFF8F2" opacity="0.9" transform="rotate(-35,25.2,20.1)"/><rect x="15.2" y="20" width="9.6" height="1.8" rx="2" fill="#FFF8F2" opacity="0.9"/><circle cx="12" cy="16.8" r="2.4" fill="#FFF8F2"/><circle cx="28" cy="16.8" r="2.4" fill="#FFF8F2"/><circle cx="20.1" cy="25.7" r="2.5" fill="#FFF8F2"/></svg></span> DukiAI Memory</span>
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
        "\n%s\n📧  [DEV EMAIL — not sent] To: %s\n    Subject: %s\n%s\n    %s\n%s\n",
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
    title = _text(
        lang,
        "Verify your identity",
        "Xác minh danh tính của bạn",
    )
    code_label = _text(lang, "Verification Code", "Mã xác nhận")

    body_html = f"""\
<h2>{title}</h2>
<p style="margin:0 0 6px;color:#374151;font-size:15px;">{greeting}</p>
<p style="margin:0 0 4px;color:#374151;font-size:15px;">{intro}</p>
<div class="code-wrap">
  <div class="code-box">
    <span class="code-label">{code_label}</span>
    <span class="code-digits">{escape(code)}</span>
  </div>
</div>
<p style="margin:0 0 12px;color:#374151;font-size:14px;">{expiry_note}</p>
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
    """Send a rich welcome email after registration or email verification."""
    lang = _normalize_locale(locale)
    display_name = _safe_name(name, lang)

    subject = _text(
        lang, "Welcome to DukiAI Memory ✨", "Chào mừng đến với DukiAI Memory ✨"
    )

    greeting = _text(lang, f"Hi {display_name},", f"Xin chào {display_name},")
    intro = _text(
        lang,
        "Your memory companion is ready. Here's what you can do:",
        "Trợ lý ký ức của bạn đã sẵn sàng. Đây là những gì bạn có thể làm:",
    )
    cta = _text(lang, "Open DukiAI Memory", "Mở DukiAI Memory")
    closing = _text(
        lang,
        "Capture anything. Remember everything. DukiAI Memory works quietly in the background — surfacing the right memory at the right moment.",
        "Lưu bất cứ điều gì. Nhớ tất cả mọi thứ. DukiAI Memory hoạt động lặng lẽ — đưa ký ức đúng ra vào đúng lúc.",
    )
    tagline_quote = _text(
        lang,
        '"Saving is central. Forgetting is normal."',
        '"Lưu giữ là trọng tâm. Quên là bình thường."',
    )

    # Feature tiles: (icon_html, title, description) ordered for 2×2 grid
    features = [
        (
            "&#x270F;&#xFE0F;",
            _text(lang, "Text Notes", "Ghi chú văn bản"),
            _text(
                lang,
                "Capture any thought in seconds",
                "Lưu bất kỳ suy nghĩ nào trong vài giây",
            ),
        ),
        (
            "&#x1F399;&#xFE0F;",
            _text(lang, "Voice Memos", "Ghi âm giọng nói"),
            _text(
                lang,
                "Speak &amp; AI transcribes for you",
                "Nói chuyện &amp; AI ghi chép lại",
            ),
        ),
        (
            "&#x1F517;",
            _text(lang, "Save Links", "Lưu liên kết"),
            _text(
                lang,
                "Bookmark pages with full context",
                "Lưu trang web kèm ngữ cảnh đầy đủ",
            ),
        ),
        (
            "&#x1F9E0;",
            _text(lang, "AI Recall", "Nhớ lại bằng AI"),
            _text(
                lang,
                "Relevant memories surface when you need them",
                "Ký ức liên quan tự hiện khi cần",
            ),
        ),
    ]

    # Pixel-perfect SVG of BrandMark (viewBox=40×40)
    # bg=#C2600A (brandAccent), fg=#FFF8F2 — all proportions from BrandMark.tsx
    logo_svg = (
        '<svg width="80" height="80" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        '<rect width="40" height="40" rx="11" fill="#C2600A"/>'
        '<rect x="5.2" y="9.2" width="29.6" height="20" rx="10" fill="none" stroke="#FFF8F2" stroke-width="2.2"/>'
        '<rect x="19.1" y="11.2" width="1.8" height="13.2" rx="2" fill="#FFF8F2" opacity="0.58"/>'
        '<rect x="10.4" y="19.2" width="8.8" height="1.8" rx="2" fill="#FFF8F2" opacity="0.9" transform="rotate(35,14.8,20.1)"/>'
        '<rect x="20.8" y="19.2" width="8.8" height="1.8" rx="2" fill="#FFF8F2" opacity="0.9" transform="rotate(-35,25.2,20.1)"/>'
        '<rect x="15.2" y="20" width="9.6" height="1.8" rx="2" fill="#FFF8F2" opacity="0.9"/>'
        '<circle cx="12" cy="16.8" r="2.4" fill="#FFF8F2"/>'
        '<circle cx="28" cy="16.8" r="2.4" fill="#FFF8F2"/>'
        '<circle cx="20.1" cy="25.7" r="2.5" fill="#FFF8F2"/>'
        "</svg>"
    )

    welcome_title = _text(
        lang, "Welcome to DukiAI Memory!", "Chào mừng đến với DukiAI Memory!"
    )

    def _tile(icon: str, title: str, desc: str) -> str:
        return (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="background:#FFF3E8;border:1px solid #F5C49A;border-radius:14px;">'
            '<tr><td style="padding:16px 14px;">'
            f'<div style="font-size:22px;line-height:1;margin-bottom:8px;">{icon}</div>'
            f'<p style="margin:0 0 3px;color:#2C1810;font-size:13px;font-weight:700;line-height:1.3;">{title}</p>'
            f'<p style="margin:0;color:#8B5E3C;font-size:12px;line-height:1.45;">{desc}</p>'
            "</td></tr></table>"
        )

    row1_left, row1_right, row2_left, row2_right = [_tile(*f) for f in features]

    body = f"""\
<div style="text-align:center;padding:8px 0 22px;">
  {logo_svg}
  <h2 style="margin:16px 0 4px;font-size:26px;text-align:center;color:#2C1810;">{welcome_title}</h2>
  <p style="margin:0;color:#8B5E3C;font-size:14px;text-align:center;">{greeting}</p>
</div>
<p style="margin:0 0 18px;color:#5A4035;font-size:14px;line-height:1.65;">{intro}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="border-collapse:separate;border-spacing:0;">
  <tr>
    <td style="padding:0 5px 10px 0;width:50%;vertical-align:top;">{row1_left}</td>
    <td style="padding:0 0 10px 5px;width:50%;vertical-align:top;">{row1_right}</td>
  </tr>
  <tr>
    <td style="padding:0 5px 0 0;width:50%;vertical-align:top;">{row2_left}</td>
    <td style="padding:0 0 0 5px;width:50%;vertical-align:top;">{row2_right}</td>
  </tr>
</table>

<div class="btn-wrap" style="margin-top:28px;margin-bottom:4px;">
  <a href="memoryai://" class="btn">{cta}</a>
</div>
<hr class="divider" style="margin-top:24px;">
<p style="margin:0 0 6px;color:#5A4035;font-size:13px;line-height:1.65;text-align:center;">{closing}</p>
<p class="muted" style="text-align:center;font-style:italic;">{tagline_quote}</p>"""

    html_content = _base_template(
        body,
        preheader=_text(
            lang,
            "Your memory companion is ready — start capturing now",
            "Trợ lý ký ức của bạn đã sẵn sàng — bắt đầu lưu ngay",
        ),
        locale=lang,
    )
    await send_email(email, subject, html_content)
