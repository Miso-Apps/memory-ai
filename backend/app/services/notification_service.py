"""Send Expo push notifications to registered device tokens."""
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.device_token import DeviceToken

log = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_to_user(db: AsyncSession, user_id, title: str, body: str, data: dict) -> bool:
    """
    Send a push notification to all registered devices for a user.
    Returns True if at least one message was sent successfully.
    """
    result = await db.execute(
        select(DeviceToken).where(DeviceToken.user_id == user_id)
    )
    tokens = result.scalars().all()
    if not tokens:
        log.debug("No push tokens for user %s — skipping notification", user_id)
        return False

    messages = [
        {
            "to": dt.expo_push_token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
        }
        for dt in tokens
    ]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
        resp.raise_for_status()
        log.info("Push sent to user %s (%d device(s))", user_id, len(tokens))
        return True
    except Exception as exc:
        log.warning("Push notification failed for user %s: %s", user_id, exc)
        return False
