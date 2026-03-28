"""
Link enrichment service — extracts rich content from URLs.

Supported source types (auto-detected):
  • YouTube videos  — oEmbed metadata + auto/manual captions via youtube-transcript-api
  • Twitter / X     — oEmbed headline + text
  • Facebook        — OG meta-tag extraction with oEmbed fallback for videos/reels
  • General web    — full article body via trafilatura, fallback to HTML meta-tag parsing

All functions return a plain ``LinkContent`` dict so callers don't need to know
which extraction strategy ran.
"""

from __future__ import annotations

import logging
import re
from typing import TypedDict, Optional

import httpx

log = logging.getLogger(__name__)


# ─── Return type ─────────────────────────────────────────────────────────────


class LinkContent(TypedDict, total=False):
    url: str
    title: str
    author: str
    sitename: str
    description: str
    image: str
    body: str  # main body text (article or transcript)
    source_type: str  # "youtube" | "twitter" | "article" | "webpage"


# ─── YouTube ─────────────────────────────────────────────────────────────────

_YT_PATTERNS = [
    r"(?:youtube\.com/watch\?(?:[^&]*&)*v=)([A-Za-z0-9_-]{11})",
    r"youtu\.be/([A-Za-z0-9_-]{11})",
    r"youtube\.com/embed/([A-Za-z0-9_-]{11})",
    r"youtube\.com/shorts/([A-Za-z0-9_-]{11})",
    r"youtube\.com/live/([A-Za-z0-9_-]{11})",
]


def _extract_youtube_id(url: str) -> Optional[str]:
    for pat in _YT_PATTERNS:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None


async def _fetch_youtube(url: str, video_id: str) -> LinkContent:
    content: LinkContent = {"url": url, "source_type": "youtube"}

    # 1. oEmbed — free, no API key, gives title + channel name
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.get(
                "https://www.youtube.com/oembed",
                params={
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "format": "json",
                },
            )
            if r.status_code == 200:
                data = r.json()
                content["title"] = data.get("title", "").strip()
                content["author"] = data.get("author_name", "").strip()
                content["sitename"] = "YouTube"
                thumb = (data.get("thumbnail_url") or "").strip()
                if thumb:
                    content["image"] = thumb
    except Exception as exc:
        log.debug("YouTube oEmbed failed for %s: %s", video_id, exc)

    # 2. Captions / transcript
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            TranscriptsDisabled,
            NoTranscriptFound,
            VideoUnavailable,
        )

        yapi = YouTubeTranscriptApi()
        snippets = None

        # First try preferred languages
        try:
            fetched = yapi.fetch(video_id, languages=["en", "vi", "en-US", "en-GB"])
            snippets = list(fetched)
        except (NoTranscriptFound, Exception):
            # Fall back: pick whichever transcript is available
            try:
                tlist = yapi.list(video_id)
                # Prefer manually-created, then auto-generated
                chosen = None
                for t in tlist:
                    if not t.is_generated:
                        chosen = t
                        break
                if chosen is None:
                    for t in tlist:
                        chosen = t
                        break
                if chosen:
                    fetched = chosen.fetch()
                    snippets = list(fetched)
            except Exception:
                pass

        if snippets:
            parts: list[str] = []
            for s in snippets:
                parts.append(s.text if hasattr(s, "text") else s.get("text", ""))
            raw = " ".join(p for p in parts if p)
            # Clean up [Music] [Applause] annotation noise
            raw = re.sub(r"\[[\w\s]+\]", "", raw)
            raw = re.sub(r"\s{2,}", " ", raw).strip()
            content["body"] = raw[:12_000]
    except Exception as exc:
        log.debug("YouTube transcript unavailable for %s: %s", video_id, exc)

    return content


# ─── Twitter / X ─────────────────────────────────────────────────────────────

_TWITTER_RE = re.compile(
    r"https?://(?:(?:www\.|mobile\.)?twitter\.com|x\.com)/\S+/status/(\d+)", re.I
)


async def _fetch_twitter(url: str) -> LinkContent:
    content: LinkContent = {
        "url": url,
        "source_type": "twitter",
        "sitename": "X / Twitter",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.get(
                "https://publish.twitter.com/oembed",
                params={"url": url, "omit_script": "true"},
            )
            if r.status_code == 200:
                data = r.json()
                html_snippet = data.get("html", "")
                # Extract text between <p> tags
                m = re.search(r"<p[^>]*>(.*?)</p>", html_snippet, re.S | re.I)
                if m:
                    tweet_text = re.sub(r"<[^>]+>", "", m.group(1)).strip()
                    content["body"] = tweet_text
                content["author"] = data.get("author_name", "").strip()
    except Exception as exc:
        log.debug("Twitter oEmbed failed for %s: %s", url, exc)
    return content


# ─── Facebook ────────────────────────────────────────────────────────────────

_FACEBOOK_RE = re.compile(
    r"https?://(?:(?:www\.|m\.)?facebook\.com|fb\.(?:com|me|watch))/",
    re.I,
)

# Share-URL segment → content type for oEmbed selection
#   /share/r/ → reel (video oembed)
#   /share/v/ → video (video oembed)
#   /share/p/ → post  (post  oembed)
#   /reel/    → reel (video oembed)
#   /watch/   → video (video oembed)
_FB_VIDEO_RE = re.compile(
    r"facebook\.com/(?:share/[rv]/|reel/|watch|[^/]+/videos/)",
    re.I,
)


def _clean_fb_html(html: str) -> str:
    """Strip script/style tags before meta parsing to avoid false matches."""
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S | re.I)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.S | re.I)
    return html


def _parse_og_tags(html: str) -> dict:
    """Extract Open Graph / standard meta tags from raw HTML."""
    cleaned = _clean_fb_html(html[:200_000])
    result: dict = {}

    og_map = {
        "og:title": "title",
        "og:description": "description",
        "og:site_name": "sitename",
        "og:image": "image",
        "og:type": "og_type",
    }

    for prop, key in og_map.items():
        m = re.search(
            rf'<meta[^>]+property=["\'][^"\'>]*{re.escape(prop)}[^"\'>]*["\'][^>]*content=["\']([^"\'>]*)["\']',
            cleaned,
            re.I,
        ) or re.search(
            rf'<meta[^>]+content=["\']([^"\'>]*)["\'][^>]*property=["\'][^"\'>]*{re.escape(prop)}[^"\'>]*["\']',
            cleaned,
            re.I,
        )
        if m:
            result[key] = m.group(1).strip()

    # Also try <title> tag as fallback
    if not result.get("title"):
        m = re.search(r"<title[^>]*>([^<]+)</title>", cleaned, re.I)
        if m:
            result["title"] = m.group(1).strip()

    return result


async def _fetch_facebook(url: str) -> LinkContent:
    """
    Extract content from a Facebook URL.

    Strategy:
      1. Fetch with Googlebot UA — Facebook returns full HTML + OG tags for
         recognised crawler User-Agents, while a browser UA triggers a login
         wall or 400 error for share / reel links.
      2. Parse Open Graph meta tags; unescape HTML entities in values.
      3. Try Facebook oEmbed JSON endpoint for posts / videos / reels.
      4. Light trafilatura pass for any remaining extractable text.
      5. URL-structure fallback: derive a human label from the path.
    """
    content: LinkContent = {"url": url, "source_type": "facebook", "sitename": "Facebook"}

    # Googlebot UA reliably receives 200 + OG tags from Facebook for public
    # reels, posts and pages; a Chrome UA often returns 400 for share links.
    googlebot_headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; Googlebot/2.1; "
            "+http://www.google.com/bot.html)"
        ),
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.5",
    }

    html = ""
    canonical_url = url

    # ── Fetch HTML (follow redirects to resolve /share/… short-links) ─────────
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers=googlebot_headers,
        ) as client:
            r = await client.get(url)
            canonical_url = str(r.url)  # resolved URL after redirects
            content["url"] = canonical_url
            if r.status_code == 200:
                html = r.text
            else:
                log.debug("Facebook fetch returned %s for %s", r.status_code, url)
    except Exception as exc:
        log.warning("Facebook HTML fetch failed for %s: %s", url, exc)

    # ── Open Graph meta tags ────────────────────────────────────────────────────
    if html:
        import html as _html_mod
        og = _parse_og_tags(html)
        if og.get("title"):
            content.setdefault("title", _html_mod.unescape(og["title"]))
        if og.get("description"):
            desc = _html_mod.unescape(og["description"])
            content.setdefault("description", desc)
            if not content.get("body") and len(desc) > 20:
                content["body"] = desc
        if og.get("sitename"):
            content["sitename"] = og["sitename"]
        if og.get("image"):
            content.setdefault("image", og["image"])

    # ── oEmbed (works for some public posts/videos without an access token) ─────
    is_video = bool(_FB_VIDEO_RE.search(url) or _FB_VIDEO_RE.search(canonical_url))
    oembed_endpoint = (
        "https://www.facebook.com/plugins/video/oembed.json/"
        if is_video
        else "https://www.facebook.com/plugins/post/oembed.json/"
    )
    try:
        async with httpx.AsyncClient(
            timeout=10.0, follow_redirects=True, headers=googlebot_headers
        ) as client:
            r = await client.get(oembed_endpoint, params={"url": canonical_url})
            if r.status_code == 200:
                data = r.json()
                if data.get("title"):
                    content.setdefault("title", data["title"].strip())
                if data.get("author_name"):
                    content.setdefault("author", data["author_name"].strip())
                oembed_html = data.get("html", "")
                if oembed_html:
                    body_text = re.sub(r"<[^>]+>", " ", oembed_html)
                    body_text = re.sub(r"\s{2,}", " ", body_text).strip()
                    if len(body_text) > 20:
                        content.setdefault("body", body_text[:4_000])
    except Exception as exc:
        log.debug("Facebook oEmbed failed for %s: %s", canonical_url, exc)

    # ── trafilatura — last resort for any extractable text ─────────────────────
    if html and not content.get("body"):
        try:
            import trafilatura

            body = trafilatura.extract(
                html,
                include_comments=False,
                include_tables=False,
                no_fallback=False,
                url=canonical_url,
            )
            if body:
                content["body"] = body[:8_000]
        except Exception as exc:
            log.debug("trafilatura extraction failed for %s: %s", canonical_url, exc)

    # ── URL-structure fallback label ─────────────────────────────────────────────
    if not content.get("title"):
        path_lower = canonical_url.lower()
        orig_lower = url.lower()
        if "/reel/" in path_lower or "/share/r/" in orig_lower:
            content["title"] = "Facebook Reel"
        elif "/watch" in path_lower or "/share/v/" in orig_lower or "/videos/" in path_lower:
            content["title"] = "Facebook Video"
        elif "/share/p/" in orig_lower or "/posts/" in path_lower:
            content["title"] = "Facebook Post"
        elif "/photo" in path_lower:
            content["title"] = "Facebook Photo"
        else:
            content["title"] = "Facebook Content"

    return content


# ─── General article / webpage ───────────────────────────────────────────────

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


async def _fetch_article(url: str) -> LinkContent:
    content: LinkContent = {"url": url, "source_type": "article"}
    html = ""

    # ── Fetch ──────────────────────────────────────────────────────────────────
    try:
        headers = {
            "User-Agent": _BROWSER_UA,
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
            "Accept-Language": "en-US,en;q=0.9",
        }
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers=headers,
        ) as client:
            r = await client.get(url)
            r.raise_for_status()
            html = r.text
    except Exception as exc:
        log.warning("Article fetch failed for %s: %s", url, exc)
        return content

    # ── trafilatura ────────────────────────────────────────────────────────────
    try:
        import trafilatura

        metadata = trafilatura.extract_metadata(html, default_url=url)
        if metadata:
            content["title"] = (metadata.title or "").strip()
            content["description"] = (metadata.description or "").strip()
            content["author"] = (metadata.author or "").strip()
            content["sitename"] = (metadata.sitename or "").strip()
            content["image"] = (metadata.image or "").strip()

        body = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
            url=url,
        )
        if body:
            content["body"] = body[:12_000]
    except Exception as exc:
        log.debug("trafilatura extraction failed for %s: %s", url, exc)

    # ── HTML meta-tag fallback ─────────────────────────────────────────────────
    if not content.get("title") and not content.get("description"):
        try:
            from html.parser import HTMLParser

            class _Meta(HTMLParser):
                def __init__(self) -> None:
                    super().__init__()
                    self.title = ""
                    self.desc = ""
                    self.image = ""
                    self._in_title = False

                def handle_starttag(self, tag, attrs):
                    if tag == "title":
                        self._in_title = True
                    elif tag == "meta":
                        d = dict(attrs)
                        name = d.get("name", "").lower()
                        prop = d.get("property", "").lower()
                        if name == "description" or prop in (
                            "og:description",
                            "twitter:description",
                        ):
                            if not self.desc:
                                self.desc = d.get("content", "").strip()
                        if prop == "og:title" and not self.title:
                            self.title = d.get("content", "").strip()
                        if prop in ("og:image", "twitter:image") and not self.image:
                            self.image = d.get("content", "").strip()

                def handle_data(self, data):
                    if self._in_title and not self.title:
                        self.title = data.strip()

                def handle_endtag(self, tag):
                    if tag == "title":
                        self._in_title = False

            p = _Meta()
            p.feed(html[:80_000])
            if p.title:
                content.setdefault("title", p.title)
            if p.desc:
                content.setdefault("description", p.desc)
            if p.image:
                content.setdefault("image", p.image)
        except Exception:
            pass

    # Classify as plain webpage if no body text was extracted
    if not content.get("body"):
        content["source_type"] = "webpage"

    return content


# ─── Router ──────────────────────────────────────────────────────────────────


async def fetch_link_content(url: str) -> LinkContent:
    """
    Auto-detect the URL type and return structured ``LinkContent``.

    Priority:
      1. YouTube
      2. Twitter / X
      3. Facebook
      4. Everything else → article extraction
    """
    vid = _extract_youtube_id(url)
    if vid:
        return await _fetch_youtube(url, vid)

    if _TWITTER_RE.search(url):
        return await _fetch_twitter(url)

    if _FACEBOOK_RE.search(url):
        return await _fetch_facebook(url)

    return await _fetch_article(url)


def build_prompt_text(lc: LinkContent) -> str:
    """
    Flatten a ``LinkContent`` dict into a compact text block suitable for
    passing to an LLM summarisation prompt.
    """
    lines: list[str] = [f"URL: {lc.get('url', '')}"]
    if lc.get("source_type") == "youtube":
        lines.append(f"Platform: YouTube")
    elif lc.get("source_type") == "facebook":
        lines.append(f"Platform: Facebook")
    elif lc.get("sitename"):
        lines.append(f"Site: {lc['sitename']}")

    if lc.get("title"):
        lines.append(f"Title: {lc['title']}")
    if lc.get("author"):
        lines.append(f"Author / Channel: {lc['author']}")
    if lc.get("description"):
        lines.append(f"Description: {lc['description']}")
    if lc.get("body"):
        body = lc["body"]
        if lc.get("source_type") == "youtube":
            label = "Transcript"
        elif lc.get("source_type") == "facebook":
            label = "Post"
        else:
            label = "Article"
        lines.append(f"{label} excerpt:\n{body[:6_000]}")
    return "\n".join(lines)
