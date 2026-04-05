/**
 * DukiAI Memory Extension — Options / Settings Controller
 */

(async () => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const show = (el) => { if (el) el.hidden = false; };
  const hide = (el) => { if (el) el.hidden = true; };

  // ─── Load saved settings ──────────────────────────────

  const { apiUrl, language } = await chrome.storage.sync.get({
    apiUrl: 'https://api.dukiai.com',
    language: 'en',
  });

  const apiUrlInput = $('#api-url');
  const langSelect  = $('#language');

  if (apiUrlInput) apiUrlInput.value = apiUrl;
  if (langSelect) langSelect.value = language;

  // ─── Save on change ────────────────────────────────────

  apiUrlInput?.addEventListener('change', () => {
    const val = apiUrlInput.value.trim().replace(/\/+$/, '') || 'https://api.dukiai.com';
    apiUrlInput.value = val;
    chrome.storage.sync.set({ apiUrl: val });
  });

  langSelect?.addEventListener('change', () => {
    chrome.storage.sync.set({ language: langSelect.value });
  });

  // ─── Test connection ───────────────────────────────────

  const statusEl = $('#connection-status');

  $('#test-connection')?.addEventListener('click', async () => {
    const btn = $('#test-connection');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    hide(statusEl);

    try {
      const base = apiUrlInput.value.trim().replace(/\/+$/, '');
      const res = await fetch(`${base}/health`, { method: 'GET' });
      if (res.ok) {
        statusEl.className = 'status success';
        statusEl.textContent = '✓ Connected successfully';
      } else {
        statusEl.className = 'status error';
        statusEl.textContent = `✗ Server returned ${res.status}`;
      }
    } catch (err) {
      statusEl.className = 'status error';
      statusEl.textContent = `✗ Cannot connect: ${err.message}`;
    } finally {
      show(statusEl);
      btn.disabled = false;
      btn.textContent = 'Test';
    }
  });

  // ─── Chrome shortcuts link ─────────────────────────────

  $('#chrome-shortcuts-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    // chrome:// URLs can't be opened directly, guide user
    try {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } catch {
      alert('Go to chrome://extensions/shortcuts in your address bar to change keyboard shortcuts.');
    }
  });

  // ─── Offline Queue ─────────────────────────────────────

  async function loadQueue() {
    const queue = await memoryApi.getOfflineQueue();
    const countEl = $('#queue-count');
    const flushBtn = $('#queue-flush');
    const itemsEl = $('#queue-items');

    if (queue.length === 0) {
      countEl.textContent = 'No memories queued';
      hide(flushBtn);
      itemsEl.innerHTML = '';
    } else {
      countEl.textContent = `${queue.length} ${queue.length === 1 ? 'memory' : 'memories'} waiting to sync`;
      show(flushBtn);
      itemsEl.innerHTML = queue.map(item => `
        <div class="queue-item">
          <span>${escapeHtml((item.content || '').slice(0, 50))}${(item.content || '').length > 50 ? '…' : ''}</span>
          <span class="queue-item-type">${item.type || 'text'}</span>
        </div>
      `).join('');
    }
  }

  $('#queue-flush')?.addEventListener('click', async () => {
    const btn = $('#queue-flush');
    btn.disabled = true;
    btn.textContent = 'Syncing…';
    try {
      const { flushed, failed } = await memoryApi.flushOfflineQueue();
      alert(`Synced ${flushed} ${flushed === 1 ? 'memory' : 'memories'}${failed > 0 ? `, ${failed} failed` : ''}.`);
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sync Now';
      loadQueue();
    }
  });

  await loadQueue();

  // ─── Account ───────────────────────────────────────────

  const authed = await memoryApi.isAuthenticated();
  const accountSection = $('#account-section');

  if (authed) {
    show(accountSection);
    const { user } = await memoryApi.getTokens();
    if (user) {
      $('#opts-name').textContent = user.name || user.email?.split('@')[0] || 'User';
      $('#opts-email').textContent = user.email || '';
      $('#opts-avatar').textContent = (user.name || user.email || 'U')[0].toUpperCase();
    }
  }

  $('#opts-logout')?.addEventListener('click', async () => {
    await memoryApi.logout();
    hide(accountSection);
  });

  // ─── Helpers ───────────────────────────────────────────

  function escapeHtml(s) {
    const d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
  }
})();
