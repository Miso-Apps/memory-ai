/**
 * Memory AI Extension — Content Script
 * Selected text capture, page metadata extraction, on-page feedback toast.
 */

(() => {
  // ─── Message Handling ───────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    switch (msg.type) {
      case 'GET_SELECTION': {
        const text = window.getSelection()?.toString()?.trim() || '';
        reply({ text });
        break;
      }

      case 'GET_PAGE_META': {
        reply(extractPageMeta());
        break;
      }

      case 'SHOW_FEEDBACK': {
        showFeedback(msg.message || 'Saved to Memory AI');
        reply({ ok: true });
        break;
      }

      // Legacy compat
      case 'SHOW_SAVE_FEEDBACK': {
        showFeedback('Saved to Memory AI');
        reply({ ok: true });
        break;
      }

      default:
        reply({ ok: false });
    }
    return false;
  });

  // ─── Page Metadata Extraction ──────────────────────────

  function extractPageMeta() {
    const get = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';

    const title = get('meta[property="og:title"]')
      || get('meta[name="twitter:title"]')
      || document.title || '';

    const description = get('meta[property="og:description"]')
      || get('meta[name="twitter:description"]')
      || get('meta[name="description"]')
      || '';

    const image = get('meta[property="og:image"]')
      || get('meta[name="twitter:image"]')
      || '';

    const siteName = get('meta[property="og:site_name"]') || '';

    const favicon = document.querySelector('link[rel*="icon"]')?.href
      || `${location.origin}/favicon.ico`;

    const canonical = document.querySelector('link[rel="canonical"]')?.href
      || location.href;

    return { title, description, image, siteName, favicon, canonical, url: location.href };
  }

  // ─── On-Page Feedback Toast ────────────────────────────

  let feedbackTimer = null;

  function showFeedback(message) {
    // Remove existing
    const old = document.getElementById('memoryai-feedback');
    if (old) { old.remove(); clearTimeout(feedbackTimer); }

    const host = document.createElement('div');
    host.id = 'memoryai-feedback';

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        @keyframes mai-in {
          from { transform: translateY(16px) scale(.95); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes mai-out {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to   { transform: translateY(16px) scale(.95); opacity: 0; }
        }
        .toast {
          all: initial;
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: linear-gradient(135deg, #8B5CF6, #7C3AED);
          color: #fff;
          border-radius: 12px;
          font: 600 14px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          box-shadow: 0 8px 32px rgba(139,92,246,.35), 0 2px 8px rgba(0,0,0,.1);
          animation: mai-in .3s cubic-bezier(.34,1.56,.64,1);
          pointer-events: none;
        }
        .toast.leaving { animation: mai-out .2s ease-in forwards; }
        svg { flex-shrink: 0; }
      </style>
      <div class="toast">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        ${escapeHtml(message)}
      </div>
    `;

    document.body.appendChild(host);

    feedbackTimer = setTimeout(() => {
      const t = shadow.querySelector('.toast');
      if (t) t.classList.add('leaving');
      setTimeout(() => host.remove(), 250);
    }, 2200);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
})();
