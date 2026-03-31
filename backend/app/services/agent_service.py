"""Agent AI functions: intention extraction, synthesis, tension detection."""
import logging
from typing import Optional
from openai import AsyncOpenAI
from app.config import settings

log = logging.getLogger(__name__)


def _has_valid_key() -> bool:
    return bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("sk-fake"))


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def extract_intention(content: str) -> Optional[str]:
    """Return the extracted intention phrase, or None if no intention found."""
    if not _has_valid_key():
        return None
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=100,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract intentions from text. "
                        "An intention is a first-person statement of future action: "
                        "'I should', 'I want to', 'I need to', 'I plan to', 'I'm going to', "
                        "'I will', 'I must', 'I'd like to'. "
                        "If the text contains an intention, return ONLY the extracted intention phrase (max 80 chars). "
                        "If no intention, return NONE."
                    ),
                },
                {"role": "user", "content": content[:500]},
            ],
        )
        result = resp.choices[0].message.content.strip()
        if not result or result.upper() == "NONE":
            return None
        return result[:200]
    except Exception as exc:
        log.warning("extract_intention failed: %s", exc)
        return None


async def detect_tension(content1: str, content2: str) -> bool:
    """Return True if the two memory contents express contradictory stances."""
    if not _has_valid_key():
        return False
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=10,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Do these two memories express opposing views, contradictory decisions, "
                        "or conflicting stances on the same topic? Reply only YES or NO."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Memory 1: {content1[:300]}\n\nMemory 2: {content2[:300]}",
                },
            ],
        )
        return resp.choices[0].message.content.strip().upper().startswith("YES")
    except Exception as exc:
        log.warning("detect_tension failed: %s", exc)
        return False


async def synthesize_arc(summaries: list[str], language: str = "en") -> str:
    """Synthesize a narrative from a cluster of related memory summaries."""
    lang_note = "Respond in Vietnamese." if language == "vi" else "Respond in English."
    bullets = "\n".join(f"- {s[:200]}" for s in summaries)
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=300,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a thoughtful personal memory assistant. {lang_note} "
                        "Given a set of memories a person has saved over recent weeks, "
                        "write 2-3 sentences identifying the theme they've been exploring "
                        "and where their thinking seems to have landed. Be warm but direct. "
                        "End with one open question they haven't answered yet."
                    ),
                },
                {"role": "user", "content": f"Memories:\n{bullets}"},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        log.warning("synthesize_arc failed: %s", exc)
        return "I noticed a recurring theme in your recent memories."


async def synthesize_memories(contents: list[str], language: str = "en") -> str:
    """On-demand synthesis of user-selected memories."""
    lang_note = "Respond in Vietnamese." if language == "vi" else "Respond in English."
    bullets = "\n".join(f"- {c[:300]}" for c in contents)
    try:
        resp = await _client().chat.completions.create(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=350,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a thoughtful personal memory assistant. {lang_note} "
                        "Given a set of memories the user selected, identify: "
                        "1) what they have in common, "
                        "2) any tensions or contradictions between them, "
                        "3) the key insight that connects them. "
                        "Be concise (3-5 sentences). Do not list bullet points — write as flowing prose."
                    ),
                },
                {"role": "user", "content": f"Selected memories:\n{bullets}"},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        log.warning("synthesize_memories failed: %s", exc)
        return "Here's what connects these memories."
