"""
AI service — wraps OpenAI for summarisation and Whisper transcription.
Gracefully degrades (returns None) when no valid API key is configured.
"""

from __future__ import annotations

import logging
from typing import Optional, List

log = logging.getLogger(__name__)

# Placeholder values that mean "no key configured"
_PLACEHOLDER_PREFIXES = ("sk-your-", "your-", "")


def _has_valid_key() -> bool:
    """Return True only when the settings key looks like a real OpenAI key."""
    from app.config import settings

    key = (settings.OPENAI_API_KEY or "").strip()
    if not key:
        return False
    for prefix in _PLACEHOLDER_PREFIXES:
        if (
            prefix
            and key.startswith(prefix)
            and "openai" not in key.lower()
            and len(key) < 30
        ):
            return False
    # Real keys start with "sk-" and are > 30 chars
    return key.startswith("sk-") and len(key) > 30


_LANGUAGE_NAMES = {
    "vi": "Vietnamese",
    "en": "English",
}


def _language_instruction(language: str) -> str:
    """Return a language instruction to append to system prompts."""
    lang = language.lower()[:2] if language else "en"
    if lang == "en":
        return ""
    name = _LANGUAGE_NAMES.get(lang, lang.capitalize())
    return f" Always respond in {name}."


async def generate_summary(
    content: str, memory_type: str, language: str = "en"
) -> Optional[str]:
    """
    Generate a concise AI summary for a memory.

    Returns None (silently) when no valid OpenAI key is configured or on any
    API error.
    """
    if not _has_valid_key():
        log.debug("OpenAI key not configured — skipping summarisation")
        return None

    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        type_hints = {
            "text": "a personal note",
            "voice": "a voice memo (transcription)",
            "link": "a saved web link / URL",
            "rich": "a mixed-media note with text, images, and/or voice",
        }
        hint = type_hints.get(memory_type, "a note")
        lang_note = _language_instruction(language)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant that creates concise, "
                        "actionable summaries of personal notes. "
                        "Return ONE sentence (max 20 words) that captures the key point."
                        + lang_note
                    ),
                },
                {
                    "role": "user",
                    "content": f"Summarise this {hint}:\n\n{content[:4000]}",
                },
            ],
            max_tokens=60,
            temperature=0.3,
        )
        summary = response.choices[0].message.content or ""
        return summary.strip() or None
    except Exception as exc:
        log.warning("OpenAI summarisation failed: %s", exc)
        return None


async def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate a vector embedding for the given text using OpenAI Embeddings API.

    Returns a list of floats (the embedding vector), or None when no valid
    OpenAI key is configured or on any API error.
    """
    if not _has_valid_key():
        log.debug("OpenAI key not configured — skipping embedding generation")
        return None

    if not text or not text.strip():
        return None

    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Truncate to ~8K tokens worth of text (~32K chars) to stay within model limits
        truncated = text[:32000]

        response = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=truncated,
            dimensions=settings.EMBEDDING_DIM,
        )
        embedding = response.data[0].embedding
        return embedding
    except Exception as exc:
        log.warning("OpenAI embedding generation failed: %s", exc)
        return None


async def transcribe_audio(file_bytes: bytes, filename: str) -> Optional[str]:
    """
    Transcribe audio bytes using OpenAI Whisper.

    Returns None when no valid key is configured or on any error.
    """
    if not _has_valid_key():
        log.debug("OpenAI key not configured — skipping transcription")
        return None

    try:
        import io
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        audio_file = io.BytesIO(file_bytes)
        audio_file.name = filename  # Whisper uses filename to detect format

        transcript = await client.audio.transcriptions.create(
            model=settings.WHISPER_MODEL,
            file=audio_file,
        )
        return (transcript.text or "").strip() or None
    except Exception as exc:
        log.warning("Whisper transcription failed: %s", exc)
        return None


async def stream_search_summary(
    query: str,
    memory_snippets: list[str],
    language: str = "en",
):
    """
    Async generator that streams an AI insight about search results token-by-token.

    Yields plain text chunks (strings).  Stops immediately if OpenAI is not
    configured or the snippet list is empty.
    """
    if not _has_valid_key() or not memory_snippets:
        return

    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        snippets_text = "\n".join(f"- {s[:150]}" for s in memory_snippets[:12])
        lang_note = _language_instruction(language)

        stream = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise personal knowledge analyst. "
                        "Your role is to synthesize a user's saved memories into a focused, "
                        "informative summary that directly addresses their search intent. "
                        "Rules: "
                        "1. Open with the most relevant finding — tie it explicitly to the query. "
                        "2. Surface concrete details: specific dates, names, quantities, decisions, or action items present in the memories. "
                        "3. Identify meaningful patterns, recurring topics, or notable gaps relevant to the query. "
                        "4. Keep the tone formal and direct — no filler phrases, no flattery. "
                        "5. Do not list raw memory contents — synthesize and interpret. "
                        "6. Limit the response to 3-4 focused sentences. "
                        "7. Formatting: use **bold** for concrete facts (names, dates, quantities, decisions, action items); "
                        "use *italic* for patterns, themes, or interpretive observations. Apply selectively — only the most significant terms."
                        + lang_note
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'Search query: "{query}"\n\n'
                        f"Matched memories ({len(memory_snippets)} results):\n{snippets_text}\n\n"
                        "Provide a formal, information-dense synthesis that directly answers what the query is looking for, citing specific details from the memories above. Use **bold** for key facts and *italic* for patterns."
                    ),
                },
            ],
            max_tokens=500,
            temperature=0.3,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as exc:
        log.warning("OpenAI search results stream failed: %s", exc)


async def summarize_search_results(
    query: str,
    memory_snippets: list[str],
    language: str = "en",
) -> Optional[str]:
    """
    Generate a 1-2 sentence AI insight about a set of search results.

    Given the user's search query and the content of relevant memories,
    returns a warm, concise synthesis of themes or patterns found.
    Returns None when OpenAI is unavailable or the snippet list is empty.
    """
    if not _has_valid_key() or not memory_snippets:
        return None

    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        snippets_text = "\n".join(f"- {s[:150]}" for s in memory_snippets[:12])
        lang_note = _language_instruction(language)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise personal knowledge analyst. "
                        "Given a search query and a set of matched memories, write exactly 1-2 sentences "
                        "that directly address the query's intent. "
                        "Cite the most relevant concrete detail (date, name, decision, action item, or quantity) "
                        "found in the memories. Be formal, factual, and information-dense. "
                        "Do not use filler phrases such as 'These memories show' or 'It appears'. "
                        "Formatting: use **bold** for concrete facts (names, dates, quantities, decisions); "
                        "use *italic* for patterns or interpretive observations. Apply sparingly."
                        + lang_note
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'Search query: "{query}"\n\n'
                        f"Matched memories ({len(memory_snippets)} results):\n{snippets_text}\n\n"
                        "Summarize what these results reveal about the query in 1-2 formal, specific sentences. Use **bold** for key facts and *italic* for patterns."
                    ),
                },
            ],
            max_tokens=120,
            temperature=0.3,
        )
        result = response.choices[0].message.content or ""
        return result.strip() or None
    except Exception as exc:
        log.warning("OpenAI search results summary failed: %s", exc)
        return None


async def generate_reflection_markdown(
    thought: str,
    memory_snippets: list[str],
    language: str = "en",
) -> Optional[str]:
    """Generate a markdown reflection for a thought using related memory snippets."""
    if not _has_valid_key() or not thought.strip():
        return None

    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        snippets_text = "\n".join(f"- {s[:220]}" for s in memory_snippets[:10])
        lang_note = _language_instruction(language)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a personal reflection coach. "
                        "Return STRICT markdown with this structure: "
                        "1) '## Reflection' heading, "
                        "2) one short paragraph, "
                        "3) '### Signals from memories' heading with 2-4 bullet points, "
                        "4) '### Next action' heading with exactly 2-3 numbered action. "
                        "Use **bold** for concrete facts and *italic* for patterns. "
                        "No JSON, no code blocks, no preamble." + lang_note
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Thought: {thought}\n\n"
                        f"Related memories ({len(memory_snippets)}):\n{snippets_text or '- (none)'}\n\n"
                        "Write the reflection in the required markdown structure." + lang_note
                    ),
                },
            ],
            max_tokens=1024,
            temperature=0.4,
        )
        result = (response.choices[0].message.content or "").strip()
        return result or None
    except Exception as exc:
        log.warning("OpenAI reflection generation failed: %s", exc)
        return None


async def group_memories_by_topic(
    memory_contents: dict[str, str],
    language: str = "en",
) -> list[dict]:
    """
    Use OpenAI to group memories by topic/category.

    Args:
        memory_contents: mapping of memory_id → short content text

    Returns:
        List of dicts with 'title' (group name) and 'memory_ids' (list of IDs).
        Falls back to a single "All" group when OpenAI is unavailable.
    """
    all_ids = list(memory_contents.keys())

    if not _has_valid_key() or len(all_ids) < 2:
        return [{"title": "All", "memory_ids": all_ids}]

    try:
        import json as _json
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Build numbered list for the prompt
        items_text = "\n".join(
            f"{i + 1}. [{mid}] {content}"
            for i, (mid, content) in enumerate(memory_contents.items())
        )

        lang_note = _language_instruction(language)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant that organizes personal notes into "
                        "meaningful groups. Given a list of notes, group them by topic or purpose. "
                        "Return ONLY valid JSON: an array of objects with 'title' (short group name, "
                        "2-4 words) and 'memory_ids' (array of the [id] strings). "
                        "Each note must appear in exactly one group. Use 3-6 groups max. "
                        "Group names should be personalized and descriptive."
                        + lang_note
                    ),
                },
                {
                    "role": "user",
                    "content": f"Group these notes:\n\n{items_text}",
                },
            ],
            max_tokens=1024,
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "{}"
        parsed = _json.loads(raw)

        # Support both {"groups": [...]} and direct [...]
        groups = parsed if isinstance(parsed, list) else parsed.get("groups", [])

        if not isinstance(groups, list) or not groups:
            return [{"title": "All", "memory_ids": all_ids}]

        # Validate structure
        valid_groups = []
        assigned = set()
        for g in groups:
            if isinstance(g, dict) and "title" in g and "memory_ids" in g:
                ids = [
                    mid
                    for mid in g["memory_ids"]
                    if mid in memory_contents and mid not in assigned
                ]
                if ids:
                    valid_groups.append({"title": g["title"], "memory_ids": ids})
                    assigned.update(ids)

        # Catch unassigned
        unassigned = [mid for mid in all_ids if mid not in assigned]
        if unassigned:
            valid_groups.append({"title": "Other", "memory_ids": unassigned})

        return (
            valid_groups if valid_groups else [{"title": "All", "memory_ids": all_ids}]
        )
    except Exception as exc:
        log.warning("OpenAI grouping failed: %s", exc)
        return [{"title": "All", "memory_ids": all_ids}]


async def describe_image(
    file_bytes: bytes, filename: str, language: str = "en"
) -> Optional[str]:
    """
    Use GPT-4o Vision to analyse an uploaded image and produce a rich text
    description that can be stored as the memory content for later search
    and AI recommendation.

    Returns None when no valid OpenAI key is configured or on any error.
    The caller should store this description as the memory's `content` field.
    """
    if not _has_valid_key():
        log.debug("OpenAI key not configured — skipping image description")
        return None

    try:
        import base64
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Encode image bytes to base64
        image_b64 = base64.b64encode(file_bytes).decode("utf-8")

        # Derive MIME type from filename extension
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "jpeg"
        mime_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "heic": "image/jpeg",  # HEIC decoded as JPEG by most pipelines
            "heif": "image/jpeg",
        }
        mime_type = mime_map.get(ext, "image/jpeg")
        lang_note = _language_instruction(language)

        response = await client.chat.completions.create(
            model="gpt-4o",  # Vision-capable model is required here
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Describe this image in detail so it can be saved as a personal memory "
                                "and found later via text search. Include:\n"
                                "1. What you see — objects, people, animals, places, activities\n"
                                "2. Setting and context — indoor/outdoor, location clues, time of day\n"
                                "3. Any visible text, signs, labels or writing\n"
                                "4. The mood, theme or purpose of the image\n\n"
                                "Write 2–4 clear, specific sentences. Be detailed enough to make it searchable."
                                + lang_note
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}",
                                "detail": "low",  # Sufficient for descriptive text; saves tokens
                            },
                        },
                    ],
                }
            ],
            max_tokens=250,
            temperature=0.2,
        )
        description = response.choices[0].message.content or ""
        return description.strip() or None
    except Exception as exc:
        log.warning("GPT-4o Vision image description failed: %s", exc)
        return None


async def fetch_and_summarize_link(url: str, language: str = "en") -> Optional[str]:
    """
    Extract rich content from a URL and produce an AI summary.

    Supported sources (auto-detected):
      • YouTube videos  — oEmbed metadata + captions/transcript
      • Twitter / X     — oEmbed tweet text
      • General pages   — full article body via trafilatura + HTML meta fallback

    Returns a concise AI summary string, or the page title when OpenAI is
    unavailable.  Returns None when the URL is unreachable or yields no content.
    """
    from app.services.link_service import fetch_link_content, build_prompt_text

    # ── 1. Extract content ────────────────────────────────────────────────────
    try:
        lc = await fetch_link_content(url)
    except Exception as exc:
        log.warning("Link content extraction failed for %s: %s", url, exc)
        return None

    # Nothing useful extracted → fall back to URL-only summary
    if not lc.get("title") and not lc.get("body") and not lc.get("description"):
        return await generate_summary(url, "link", language)

    # ── 2. No AI key — return title/description as plain text ─────────────────
    if not _has_valid_key():
        return lc.get("title") or lc.get("description") or None

    # ── 3. Build prompt ───────────────────────────────────────────────────────
    source_type = lc.get("source_type", "webpage")
    prompt_text = build_prompt_text(lc)
    lang_note = _language_instruction(language)

    # Tailor system instruction based on source type
    if source_type == "youtube":
        system_msg = (
            "You are a helpful assistant that summarises YouTube videos for a personal memory app. "
            "Write 1-2 concise sentences describing what the video is about, its key topic, "
            "and any notable insights from the transcript if available." + lang_note
        )
        user_msg = f"Summarise this YouTube video:\n\n{prompt_text}"
        max_tokens = 120
    elif source_type == "twitter":
        system_msg = (
            "You are a helpful assistant. Summarise this tweet or thread in ONE sentence."
            + lang_note
        )
        user_msg = f"Summarise this tweet:\n\n{prompt_text}"
        max_tokens = 60
    else:
        system_msg = (
            "You are a helpful assistant that summarises web pages and articles for a personal memory app. "
            "Write 1-2 concise sentences capturing the main topic and key takeaway of the content."
            + lang_note
        )
        user_msg = f"Summarise this web page:\n\n{prompt_text}"
        max_tokens = 120

    # ── 4. AI summary ─────────────────────────────────────────────────────────
    try:
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        ai_response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        summary = (ai_response.choices[0].message.content or "").strip()
        return summary or lc.get("title") or None
    except Exception as exc:
        log.warning("OpenAI link summarisation failed for %s: %s", url, exc)
        return lc.get("title") or lc.get("description") or None


async def classify_content(
    content: str, memory_type: str, available_categories: list[dict]
) -> dict:
    """
    Auto-classify content into one of the available categories using AI.

    Args:
        content: The memory content to classify
        memory_type: Type of memory (text, link, voice, photo)
        available_categories: List of dicts with 'id', 'name', 'description'

    Returns:
        Dict with 'category_id' and 'confidence' (0-100).
        Returns {'category_id': None, 'confidence': 0} if classification fails.
    """
    if not available_categories:
        return {"category_id": None, "confidence": 0}

    # Rule-based classification for common patterns (fast fallback)
    content_lower = content.lower()

    # URL pattern detection
    if memory_type == "link" or content_lower.startswith(("http://", "https://")):
        # Detect specific URL types
        if any(
            x in content_lower
            for x in ["youtube.com", "netflix.com", "spotify.com", "twitch.tv"]
        ):
            for cat in available_categories:
                if cat["name"].lower() == "entertainment":
                    return {"category_id": cat["id"], "confidence": 85}
        if any(
            x in content_lower
            for x in ["github.com", "stackoverflow.com", "docs.", "developer."]
        ):
            for cat in available_categories:
                if cat["name"].lower() in ("research", "work"):
                    return {"category_id": cat["id"], "confidence": 80}

    # Task detection
    task_keywords = [
        "todo",
        "task",
        "reminder",
        "need to",
        "don't forget",
        "must",
        "deadline",
        "by tomorrow",
    ]
    if any(kw in content_lower for kw in task_keywords):
        for cat in available_categories:
            if cat["name"].lower() == "tasks":
                return {"category_id": cat["id"], "confidence": 85}

    # Recipe detection
    recipe_keywords = [
        "recipe",
        "ingredients",
        "cook",
        "bake",
        "tablespoon",
        "teaspoon",
        "preheat",
    ]
    if any(kw in content_lower for kw in recipe_keywords):
        for cat in available_categories:
            if cat["name"].lower() == "recipes":
                return {"category_id": cat["id"], "confidence": 90}

    # Health detection
    health_keywords = [
        "doctor",
        "appointment",
        "medicine",
        "symptom",
        "workout",
        "exercise",
        "calories",
        "health",
    ]
    if any(kw in content_lower for kw in health_keywords):
        for cat in available_categories:
            if cat["name"].lower() == "health":
                return {"category_id": cat["id"], "confidence": 80}

    # Travel detection
    travel_keywords = [
        "flight",
        "hotel",
        "booking",
        "trip",
        "vacation",
        "airport",
        "passport",
        "travel",
    ]
    if any(kw in content_lower for kw in travel_keywords):
        for cat in available_categories:
            if cat["name"].lower() == "travel":
                return {"category_id": cat["id"], "confidence": 85}

    # Finance detection
    finance_keywords = [
        "invoice",
        "payment",
        "budget",
        "expense",
        "bank",
        "salary",
        "investment",
        "tax",
    ]
    if any(kw in content_lower for kw in finance_keywords):
        for cat in available_categories:
            if cat["name"].lower() == "finance":
                return {"category_id": cat["id"], "confidence": 85}

    # Use AI for more nuanced classification
    if not _has_valid_key():
        # Default to first category or "Personal" if no AI available
        for cat in available_categories:
            if cat["name"].lower() == "personal":
                return {"category_id": cat["id"], "confidence": 50}
        return {"category_id": available_categories[0]["id"], "confidence": 30}

    try:
        import json as _json
        from openai import AsyncOpenAI
        from app.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Build category list for prompt
        cat_list = "\n".join(
            f"- {cat['name']}: {cat.get('description', 'No description')}"
            for cat in available_categories
        )

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a classification assistant for a personal memory app. "
                        "Given content and a list of categories, classify the content into the most appropriate category. "
                        'Return ONLY valid JSON: {"category": "CategoryName", "confidence": 0-100}. '
                        "Higher confidence means you're more certain about the classification."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Content ({memory_type}): {content[:1000]}\n\nCategories:\n{cat_list}",
                },
            ],
            max_tokens=50,
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        result = _json.loads(response.choices[0].message.content or "{}")
        category_name = result.get("category", "")
        confidence = int(result.get("confidence", 50))

        # Find matching category
        for cat in available_categories:
            if cat["name"].lower() == category_name.lower():
                return {
                    "category_id": cat["id"],
                    "confidence": min(100, max(0, confidence)),
                }

        # No match - default to Personal
        for cat in available_categories:
            if cat["name"].lower() == "personal":
                return {"category_id": cat["id"], "confidence": 40}

        return {"category_id": available_categories[0]["id"], "confidence": 30}

    except Exception as exc:
        log.warning("AI classification failed: %s", exc)
        # Fallback to Personal category
        for cat in available_categories:
            if cat["name"].lower() == "personal":
                return {"category_id": cat["id"], "confidence": 30}
        return {"category_id": None, "confidence": 0}
