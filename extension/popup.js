/**
 * DukiAI Memory Extension — Popup Controller
 * Smart capture: clipboard detection, auto-type switching, page metadata,
 * character count, recent memories, offline queue status, keyboard shortcuts.
 */

(async () => {
  'use strict';

  // ─── DOM Refs ──────────────────────────────────────────

  const $      = (s) => document.querySelector(s);
  const $$     = (s) => document.querySelectorAll(s);
  const show   = (el) => { if (el) el.hidden = false; };
  const hide   = (el) => { if (el) el.hidden = true; };

  const loginScreen   = $('#screen-login');
  const captureScreen = $('#screen-capture');
  const successScreen = $('#screen-success');

  const loginForm   = $('#login-form');
  const loginEmail  = $('#login-email');
  const loginPw     = $('#login-password');
  const loginErr    = $('#login-error');
  const loginBtn    = $('#login-btn');

  const textInput   = $('#text-input');
  const charCount   = $('#char-count');
  const linkInput   = $('#link-input');
  const linkPreview = $('#link-preview');
  const selContent  = $('#selection-content');
  const selSource   = $('#selection-source');
  const selSourceUrl= $('#selection-source-url');

  const saveBtn     = $('#save-btn');
  const typeTabs    = $$('.type-tab');
  const panes       = $$('.pane');

  const clipBanner  = $('#clipboard-banner');
  const clipLabel   = $('#clipboard-label');
  const clipPreview = $('#clipboard-preview');
  const clipSaveBtn = $('#clipboard-save');
  const clipDismiss = $('#clipboard-dismiss');

  const offlineBanner = $('#offline-banner');
  const offlineText   = $('#offline-text');
  const offlineSync   = $('#offline-sync');

  const recentSection = $('#recent-section');
  const recentList    = $('#recent-list');

  const todayCount  = $('#today-count');
  const userName    = $('#user-name');
  const userAvatar  = $('#user-avatar');

  const toast       = $('#toast');
  const toastMsg    = $('#toast-msg');

  let currentType = 'text';
  let selectionData = null;
  let currentTabMeta = null;

  // ─── Init ──────────────────────────────────────────────

  const authed = await memoryApi.isAuthenticated();
  if (authed) {
    await showCapture();
  } else {
    showScreen(loginScreen);
    // Check for pending selection from context menu when not logged in
    const { pendingSelection } = await chrome.storage.local.get('pendingSelection');
    if (pendingSelection) {
      selectionData = pendingSelection;
    }
  }

  // ─── Screen Management ────────────────────────────────

  function showScreen(screen) {
    [loginScreen, captureScreen, successScreen].forEach(s => hide(s));
    show(screen);
  }

  async function showCapture() {
    showScreen(captureScreen);
    loadUserInfo();
    loadTodayCount();
    loadOfflineStatus();
    loadRecentMemories();

    // Get active tab info
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        currentTabMeta = { url: tab.url, title: tab.title };
        // Try to get richer metadata from content script
        try {
          const meta = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_META' });
          if (meta) currentTabMeta = { ...currentTabMeta, ...meta };
        } catch { /* content script may not be loaded */ }
      }
    } catch { /* no tab access */ }

    // Smart auto-detection
    await smartDetect();
    updateSaveBtn();
  }

  /** Detect context: selected text → selection tab, URL clipboard → link tab */
  async function smartDetect() {
    // 1. Check for pending selection (from context menu)
    const { pendingSelection } = await chrome.storage.local.get('pendingSelection');
    if (pendingSelection) {
      selectionData = pendingSelection;
      await chrome.storage.local.remove('pendingSelection');
      switchToType('selection');
      renderSelection(pendingSelection.text, pendingSelection.url, pendingSelection.title);
      return;
    }

    // 2. Try to get selected text from active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
        if (resp?.text && resp.text.length > 0) {
          selectionData = { text: resp.text, url: tab.url, title: tab.title };
          switchToType('selection');
          renderSelection(resp.text, tab.url, tab.title);
          return;
        }
      }
    } catch { /* content script may not be loaded on some pages */ }

    // 3. Check clipboard for URL
    try {
      const clip = await navigator.clipboard.readText();
      if (clip && clip.trim().length > 0) {
        const trimmed = clip.trim();
        if (isUrl(trimmed)) {
          showClipboardBanner('URL on clipboard', trimmed, 'link');
        } else if (trimmed.length > 20) {
          showClipboardBanner('Text on clipboard', trimmed.slice(0, 60) + (trimmed.length > 60 ? '…' : ''), 'text');
        }
      }
    } catch {
      // Clipboard permission denied — that's fine
    }

    // Default to text
    switchToType('text');
    textInput?.focus();
  }

  // ─── Login ─────────────────────────────────────────────

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(loginErr);
    setLoading(loginBtn, true);

    try {
      await memoryApi.login(loginEmail.value.trim(), loginPw.value);
      await showCapture();
    } catch (err) {
      loginErr.textContent = err.message || 'Login failed';
      show(loginErr);
    } finally {
      setLoading(loginBtn, false);
    }
  });

  // ─── Type Tabs ─────────────────────────────────────────

  typeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchToType(tab.dataset.type);
    });
  });

  function switchToType(type) {
    currentType = type;
    typeTabs.forEach(t => t.classList.toggle('active', t.dataset.type === type));
    panes.forEach(p => p.classList.toggle('active', p.id === `pane-${type}`));
    updateSaveBtn();

    if (type === 'text') textInput?.focus();
    if (type === 'link') {
      linkInput?.focus();
      // Auto-fill current page URL if link input is empty
      if (!linkInput.value && currentTabMeta?.url && !currentTabMeta.url.startsWith('chrome')) {
        linkInput.value = currentTabMeta.url;
        showLinkPreview(currentTabMeta);
        updateSaveBtn();
      }
    }
  }

  // ─── Text Input ────────────────────────────────────────

  textInput?.addEventListener('input', () => {
    charCount.textContent = textInput.value.length;
    updateSaveBtn();
  });

  // ─── Link Input ────────────────────────────────────────

  let linkPreviewTimer = null;
  linkInput?.addEventListener('input', () => {
    updateSaveBtn();
    clearTimeout(linkPreviewTimer);
    const url = linkInput.value.trim();
    if (isUrl(url)) {
      linkPreviewTimer = setTimeout(() => fetchLinkMeta(url), 400);
    } else {
      hide(linkPreview);
    }
  });

  $('#use-current-url')?.addEventListener('click', () => {
    if (currentTabMeta?.url && !currentTabMeta.url.startsWith('chrome')) {
      linkInput.value = currentTabMeta.url;
      showLinkPreview(currentTabMeta);
      updateSaveBtn();
    }
  });

  async function fetchLinkMeta(url) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url === url && currentTabMeta) {
        showLinkPreview(currentTabMeta);
        return;
      }
    } catch {}
    // If URL doesn't match current tab, just show the URL
    showLinkPreview({ url, title: new URL(url).hostname, description: '', favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` });
  }

  function showLinkPreview(meta) {
    if (!meta) { hide(linkPreview); return; }
    const title = $('#link-preview-title');
    const desc  = $('#link-preview-desc');
    const url   = $('#link-preview-url');
    const fav   = $('#link-favicon');

    title.textContent = meta.title || meta.siteName || '';
    desc.textContent  = meta.description || '';
    url.textContent   = meta.url || meta.canonical || '';
    if (meta.favicon) { fav.src = meta.favicon; show(fav); } else { hide(fav); }

    show(linkPreview);
  }

  // ─── Selection ─────────────────────────────────────────

  function renderSelection(text, sourceUrl, sourceTitle) {
    selContent.innerHTML = '';
    const pre = document.createElement('div');
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = text;
    selContent.appendChild(pre);

    if (sourceUrl) {
      selSourceUrl.textContent = sourceTitle || sourceUrl;
      selSourceUrl.href = sourceUrl;
      show(selSource);
    }
    updateSaveBtn();
  }

  // ─── Clipboard Banner ─────────────────────────────────

  function showClipboardBanner(label, preview, type) {
    clipLabel.textContent = label;
    clipPreview.textContent = preview;
    show(clipBanner);

    clipSaveBtn.onclick = async () => {
      setLoading(clipSaveBtn, true);
      try {
        const clip = await navigator.clipboard.readText();
        const content = clip.trim();
        const saveType = isUrl(content) ? 'link' : 'text';
        const result = await memoryApi.smartSave(saveType, content, { source: 'extension_clipboard' });
        showSuccess(saveType, result);
      } catch (err) {
        showToast(err.message || 'Failed to save clipboard');
      } finally {
        setLoading(clipSaveBtn, false);
      }
    };

    clipDismiss.onclick = () => hide(clipBanner);
  }

  // ─── Offline Queue ────────────────────────────────────

  async function loadOfflineStatus() {
    const queue = await memoryApi.getOfflineQueue();
    if (queue.length > 0) {
      offlineText.textContent = `${queue.length} ${queue.length === 1 ? 'memory' : 'memories'} queued`;
      show(offlineBanner);
    } else {
      hide(offlineBanner);
    }
  }

  offlineSync?.addEventListener('click', async () => {
    offlineSync.disabled = true;
    offlineSync.textContent = 'Syncing…';
    try {
      const { flushed, failed } = await memoryApi.flushOfflineQueue();
      if (flushed > 0) showToast(`Synced ${flushed} ${flushed === 1 ? 'memory' : 'memories'}`, true);
      if (failed > 0) showToast(`${failed} failed — will retry later`);
      await loadOfflineStatus();
    } catch (err) {
      showToast('Sync failed: ' + err.message);
    } finally {
      offlineSync.disabled = false;
      offlineSync.textContent = 'Sync now';
    }
  });

  // ─── Save ──────────────────────────────────────────────

  saveBtn?.addEventListener('click', handleSave);

  async function handleSave() {
    const { type, content, metadata } = buildPayload();
    if (!content) return;

    setLoading(saveBtn, true);
    try {
      const result = await memoryApi.smartSave(type, content, metadata);
      showSuccess(type, result);
    } catch (err) {
      showToast(err.message || 'Failed to save memory');
    } finally {
      setLoading(saveBtn, false);
    }
  }

  function buildPayload() {
    const meta = { source: 'extension_popup' };
    if (currentTabMeta) {
      meta.source_url = currentTabMeta.url || '';
      meta.source_title = currentTabMeta.title || '';
    }

    switch (currentType) {
      case 'text':
        return { type: 'text', content: textInput.value.trim(), metadata: meta };
      case 'link': {
        const url = linkInput.value.trim();
        if (currentTabMeta?.title) meta.link_title = currentTabMeta.title;
        if (currentTabMeta?.description) meta.link_description = currentTabMeta.description;
        if (currentTabMeta?.image) meta.link_image = currentTabMeta.image;
        if (currentTabMeta?.favicon) meta.link_favicon = currentTabMeta.favicon;
        return { type: 'link', content: url, metadata: meta };
      }
      case 'selection':
        return { type: 'text', content: selectionData?.text || '', metadata: meta };
      default:
        return { type: 'text', content: '', metadata: meta };
    }
  }

  // ─── Success ───────────────────────────────────────────

  async function showSuccess(type, result) {
    const typeLabels = { text: 'Note', link: 'Link', selection: 'Selected text' };
    const label = typeLabels[type] || 'Memory';

    if (result?._queued) {
      $('#success-type').textContent = `${label} queued — will sync when online`;
    } else {
      $('#success-type').textContent = `${label} saved successfully`;
    }

    const count = await memoryApi.getTodaySaves();
    $('#success-count').textContent = `${count} ${count === 1 ? 'memory' : 'memories'} saved today`;

    showScreen(successScreen);

    // Auto-close after 1.5s
    setTimeout(() => window.close(), 1500);
  }

  // ─── User Info ─────────────────────────────────────────

  async function loadUserInfo() {
    const { user } = await memoryApi.getTokens();
    if (user) {
      userName.textContent = user.name || user.email?.split('@')[0] || 'User';
      userAvatar.textContent = (user.name || user.email || 'U')[0].toUpperCase();
    }
  }

  async function loadTodayCount() {
    const count = await memoryApi.getTodaySaves();
    if (count > 0) {
      todayCount.textContent = count;
      show(todayCount);
    }
  }

  // ─── Recent Memories ──────────────────────────────────

  async function loadRecentMemories() {
    try {
      const data = await memoryApi.getRecentMemories(5);
      const memories = Array.isArray(data) ? data : data?.memories || data?.items || [];
      if (memories.length === 0) return;

      recentList.innerHTML = '';
      for (const mem of memories) {
        recentList.appendChild(renderRecentItem(mem));
      }
      show(recentSection);
    } catch {
      // Not critical — just don't show
    }
  }

  function renderRecentItem(mem) {
    const item = document.createElement('div');
    item.className = 'recent-item';

    const typeIcons = {
      text:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
      link:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
      photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    };

    const preview = (mem.content || '').slice(0, 45) + ((mem.content || '').length > 45 ? '…' : '');
    const timeAgo = formatTimeAgo(mem.created_at || mem.createdAt);

    item.innerHTML = `
      <div class="recent-type-icon">${typeIcons[mem.type] || typeIcons.text}</div>
      <div class="recent-text">${escapeHtml(preview)}</div>
      <div class="recent-time">${timeAgo}</div>
    `;
    return item;
  }

  // ─── Settings / Logout ────────────────────────────────

  $('#open-settings')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#open-settings-login')?.addEventListener('click', () => chrome.runtime.openOptionsPage());

  $('#logout-btn')?.addEventListener('click', async () => {
    await memoryApi.logout();
    showScreen(loginScreen);
  });

  // ─── Keyboard Shortcuts ───────────────────────────────

  document.addEventListener('keydown', (e) => {
    // ⌘+Enter or Ctrl+Enter → Save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!saveBtn.disabled) handleSave();
      return;
    }
    // Escape → close popup
    if (e.key === 'Escape') {
      window.close();
      return;
    }
    // Tab switching: Alt+1=Text, Alt+2=Link, Alt+3=Selection
    if (e.altKey && ['1','2','3'].includes(e.key)) {
      e.preventDefault();
      const types = ['text', 'link', 'selection'];
      switchToType(types[parseInt(e.key) - 1]);
    }
  });

  // ─── Helpers ───────────────────────────────────────────

  function updateSaveBtn() {
    let hasContent = false;
    switch (currentType) {
      case 'text':
        hasContent = textInput.value.trim().length > 0;
        break;
      case 'link':
        hasContent = isUrl(linkInput.value.trim());
        break;
      case 'selection':
        hasContent = !!selectionData?.text;
        break;
    }
    saveBtn.disabled = !hasContent;
  }

  function isUrl(s) {
    if (!s) return false;
    try { new URL(s); return /^https?:\/\//i.test(s); } catch { return false; }
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const spin = btn.querySelector('.btn-loading');
    if (loading) {
      btn.disabled = true;
      if (text) text.hidden = true;
      if (spin) spin.hidden = false;
    } else {
      btn.disabled = false;
      if (text) text.hidden = false;
      if (spin) spin.hidden = true;
    }
  }

  function showToast(message, isSuccess = false) {
    toastMsg.textContent = message;
    if (isSuccess) {
      toast.style.background = '#22C55E';
    } else {
      toast.style.background = '';
    }
    show(toast);
    setTimeout(() => hide(toast), 3000);
  }

  function escapeHtml(s) {
    const d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = Date.now();
    const past = new Date(dateStr).getTime();
    const diff = Math.max(0, now - past);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  }
})();
