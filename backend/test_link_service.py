"""Quick integration test for link_service."""
import asyncio
import sys

sys.path.insert(0, ".")
from app.services.link_service import fetch_link_content, build_prompt_text, _extract_youtube_id, _FACEBOOK_RE


def test_id_extraction():
    print("\n=== YouTube ID extraction ===")
    cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/abc12345678", "abc12345678"),
        ("https://youtube.com/embed/dQw4w9WgXcQ?start=10", "dQw4w9WgXcQ"),
        ("https://example.com", None),
        ("https://www.youtube.com/watch?list=PL&v=abc12345678", "abc12345678"),
    ]
    all_ok = True
    for url, expected in cases:
        got = _extract_youtube_id(url)
        ok = got == expected
        if not ok:
            all_ok = False
        print(f"  {'OK  ' if ok else 'FAIL'} {url!r} -> {got!r}")
    return all_ok


async def test_youtube():
    print("\n=== YouTube oEmbed + transcript ===")
    # Use a short video known to have English captions
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    lc = await fetch_link_content(url)
    print(f"  source_type : {lc.get('source_type')}")
    print(f"  title       : {lc.get('title')}")
    print(f"  author      : {lc.get('author')}")
    body = lc.get("body", "")
    print(f"  transcript  : {'yes (%d chars)' % len(body) if body else 'not available'}")
    print(f"  prompt (200): {build_prompt_text(lc)[:200]}")
    return bool(lc.get("title"))


async def test_article():
    print("\n=== Article extraction (Wikipedia) ===")
    url = "https://en.wikipedia.org/wiki/Python_(programming_language)"
    lc = await fetch_link_content(url)
    print(f"  source_type : {lc.get('source_type')}")
    print(f"  title       : {lc.get('title')}")
    print(f"  sitename    : {lc.get('sitename')}")
    body = lc.get("body", "")
    print(f"  body        : {'yes (%d chars)' % len(body) if body else 'empty'}")
    print(f"  prompt (200): {build_prompt_text(lc)[:200]}")
    return bool(lc.get("title"))


async def test_youtube_with_transcript():
    print("\n=== YouTube with transcript (tech talk) ===")
    # TED-Ed style or well-known educational video likely to have captions
    url = "https://www.youtube.com/watch?v=rfscVS0vtbw"  # freeCodeCamp Python tutorial
    lc = await fetch_link_content(url)
    print(f"  source_type : {lc.get('source_type')}")
    print(f"  title       : {lc.get('title')}")
    body = lc.get("body", "")
    print(f"  transcript  : {'yes (%d chars)' % len(body) if body else 'not available'}")
    if body:
        print(f"  excerpt     : {body[:150]}")
    return bool(lc.get("title"))


async def test_news():
    print("\n=== News article (Hacker News) ===")
    url = "https://news.ycombinator.com/"
    lc = await fetch_link_content(url)
    print(f"  source_type : {lc.get('source_type')}")
    print(f"  title       : {lc.get('title')}")
    body = lc.get("body", "")
    print(f"  body        : {'yes (%d chars)' % len(body) if body else 'empty'}")
    return bool(lc.get("title") or lc.get("body"))


def test_facebook_re():
    print("\n=== Facebook URL detection ===")
    cases = [
        ("https://www.facebook.com/share/r/1CLzJDCb3o/?mibextid=wwXIfr", True),
        ("https://www.facebook.com/share/v/abc123/", True),
        ("https://www.facebook.com/watch/?v=123456789", True),
        ("https://www.facebook.com/someuser/posts/123456", True),
        ("https://m.facebook.com/reel/123456789", True),
        ("https://fb.watch/abc123def/", True),
        ("https://www.youtube.com/watch?v=abc", False),
        ("https://example.com", False),
    ]
    all_ok = True
    for url, expected in cases:
        got = bool(_FACEBOOK_RE.search(url))
        ok = got == expected
        if not ok:
            all_ok = False
        print(f"  {'OK  ' if ok else 'FAIL'} {url!r} -> {got!r}")
    return all_ok


async def test_facebook_reel():
    print("\n=== Facebook reel (share link) ===")
    # Public shared reel — may need login but OG tags should still be readable
    url = "https://www.facebook.com/share/r/1CLzJDCb3o/?mibextid=wwXIfr"
    lc = await fetch_link_content(url)
    print(f"  source_type : {lc.get('source_type')}")
    print(f"  title       : {lc.get('title')}")
    print(f"  description : {lc.get('description', '')[:120]}")
    print(f"  author      : {lc.get('author')}")
    body = lc.get("body", "")
    print(f"  body        : {'yes (%d chars)' % len(body) if body else 'empty'}")
    print(f"  prompt (300): {build_prompt_text(lc)[:300]}")
    # Pass if we got at least source_type set, title or description — FB can gate content
    return lc.get("source_type") == "facebook" and bool(lc.get("title") or lc.get("description") or lc.get("body"))


async def test_facebook_public_page():
    print("\n=== Facebook public page ===")
    url = "https://www.facebook.com/nasa"
    lc = await fetch_link_content(url)
    print(f"  source_type : {lc.get('source_type')}")
    print(f"  title       : {lc.get('title')}")
    body = lc.get("body", "")
    print(f"  body        : {'yes (%d chars)' % len(body) if body else 'empty'}")
    return lc.get("source_type") == "facebook"


async def main():
    results = {}
    results["id_extraction"] = test_id_extraction()
    results["facebook_re"] = test_facebook_re()
    results["youtube_basic"] = await test_youtube()
    results["youtube_transcript"] = await test_youtube_with_transcript()
    results["article"] = await test_article()
    results["news"] = await test_news()
    results["facebook_reel"] = await test_facebook_reel()
    results["facebook_public_page"] = await test_facebook_public_page()

    print("\n=== Summary ===")
    all_pass = True
    for name, ok in results.items():
        status = "PASS" if ok else "FAIL"
        if not ok:
            all_pass = False
        print(f"  {status}  {name}")

    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    asyncio.run(main())
