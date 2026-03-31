"""Tests for agent scan logic and integration."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_extract_and_save_intention_stores_when_found():
    """_extract_and_save_intention should insert an Intention row when GPT finds one."""
    import uuid
    from unittest.mock import AsyncMock, patch, MagicMock

    memory_id = uuid.uuid4()
    user_id = uuid.uuid4()

    with patch("app.services.agent_service.extract_intention", new=AsyncMock(return_value="learn Spanish")):
        with patch("app.api.memories.AsyncSessionLocal") as MockSession:
            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            from app.api.memories import _extract_and_save_intention
            await _extract_and_save_intention(memory_id, user_id, "I should learn Spanish")

            mock_db.add.assert_called_once()
            mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_extract_and_save_intention_skips_when_none():
    """_extract_and_save_intention should not insert when no intention found."""
    import uuid
    from unittest.mock import AsyncMock, patch

    memory_id = uuid.uuid4()
    user_id = uuid.uuid4()

    with patch("app.services.agent_service.extract_intention", new=AsyncMock(return_value=None)):
        with patch("app.api.memories.AsyncSessionLocal") as MockSession:
            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            from app.api.memories import _extract_and_save_intention
            await _extract_and_save_intention(memory_id, user_id, "The weather was nice")

            mock_db.add.assert_not_called()
