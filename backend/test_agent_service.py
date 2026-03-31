"""Unit tests for agent_service — all OpenAI calls are mocked."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_extract_intention_returns_text_when_found():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "start learning Spanish"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.extract_intention("I should start learning Spanish this month")
    assert result == "start learning Spanish"


@pytest.mark.asyncio
async def test_extract_intention_returns_none_when_not_found():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "NONE"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.extract_intention("The weather was nice today")
    assert result is None


@pytest.mark.asyncio
async def test_detect_tension_returns_true_for_contradiction():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "YES"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.detect_tension("I want to quit my job", "I love my job and plan to stay")
    assert result is True


@pytest.mark.asyncio
async def test_detect_tension_returns_false_when_aligned():
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "NO"
    with patch("app.services.agent_service.AsyncOpenAI") as MockClient:
        MockClient.return_value.chat.completions.create = AsyncMock(return_value=mock_resp)
        from app.services import agent_service
        result = await agent_service.detect_tension("Exercise is good", "I should exercise more")
    assert result is False
