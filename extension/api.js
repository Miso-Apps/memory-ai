/**
 * Memory AI Extension — API Service
 * Auth, memory CRUD, offline queue, badge counter.
 */

const DEFAULT_API_URL = 'https://api.dukiai.com';

// ─── Config ──────────────────────────────────────────────

async function getApiUrl() {
  const { apiUrl } = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
  return apiUrl.replace(/\/+$/, '');
}

// ─── Token Management ────────────────────────────────────

async function getTokens() {
  return chrome.storage.local.get(['accessToken', 'refreshToken', 'user']);
}

async function saveTokens(accessToken, refreshToken, user) {
  await chrome.storage.local.set({ accessToken, refreshToken, user });
}

async function clearTokens() {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'user']);
}

async function isAuthenticated() {
  const { accessToken } = await getTokens();
  return !!accessToken;
}

// ─── API Request (auto-refresh on 401) ───────────────────

async function apiRequest(path, options = {}) {
  const baseUrl = await getApiUrl();
  const { accessToken } = await getTokens();

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const { language } = await chrome.storage.sync.get({ language: 'en' });
  headers['Accept-Language'] = language;

  let response = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (response.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const { accessToken: t } = await getTokens();
      headers['Authorization'] = `Bearer ${t}`;
      response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${response.status}`);
  }
  return response.json();
}

async function refreshAccessToken() {
  try {
    const baseUrl = await getApiUrl();
    const { refreshToken } = await getTokens();
    if (!refreshToken) return false;

    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) { await clearTokens(); return false; }

    const data = await res.json();
    const prev = await getTokens();
    await saveTokens(data.access_token, data.refresh_token || prev.refreshToken, prev.user);
    return true;
  } catch { await clearTokens(); return false; }
}

// ─── Auth ────────────────────────────────────────────────

async function login(email, password) {
  const baseUrl = await getApiUrl();
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  await saveTokens(data.access_token, data.refresh_token, data.user);
  return data.user;
}

async function logout() {
  await clearTokens();
  await updateBadge(0);
}

// ─── Memory API ──────────────────────────────────────────

async function createMemory(type, content, metadata = {}) {
  const memory = await apiRequest('/memories/', {
    method: 'POST',
    body: JSON.stringify({ type, content, metadata }),
  });
  await incrementTodaySaves();
  return memory;
}

async function getMemoryStats() {
  return apiRequest('/memories/stats');
}

async function getRecentMemories(limit = 5) {
  return apiRequest(`/memories/?limit=${limit}&offset=0`);
}

// ─── Offline Queue ───────────────────────────────────────

async function getOfflineQueue() {
  const { offlineQueue } = await chrome.storage.local.get({ offlineQueue: [] });
  return offlineQueue;
}

async function addToOfflineQueue(item) {
  const queue = await getOfflineQueue();
  queue.push({ ...item, _qid: Date.now(), _ts: new Date().toISOString() });
  await chrome.storage.local.set({ offlineQueue: queue });
  return queue.length;
}

async function flushOfflineQueue() {
  const queue = await getOfflineQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };

  let flushed = 0, failed = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await createMemory(item.type, item.content, item.metadata || {});
      flushed++;
    } catch {
      failed++;
      remaining.push(item);
    }
  }
  await chrome.storage.local.set({ offlineQueue: remaining });
  return { flushed, failed };
}

/** Save with offline fallback — never throws on network errors. */
async function smartSave(type, content, metadata = {}) {
  try {
    return await createMemory(type, content, metadata);
  } catch (err) {
    if (/fetch|network|failed to fetch|load/i.test(err.message)) {
      const n = await addToOfflineQueue({ type, content, metadata });
      return { _queued: true, _pending: n };
    }
    throw err;
  }
}

// ─── Badge Counter ───────────────────────────────────────

async function getTodaySaves() {
  const today = new Date().toISOString().slice(0, 10);
  const { saveCounter } = await chrome.storage.local.get({ saveCounter: {} });
  return saveCounter[today] || 0;
}

async function incrementTodaySaves() {
  const today = new Date().toISOString().slice(0, 10);
  const { saveCounter } = await chrome.storage.local.get({ saveCounter: {} });

  // Keep last 7 days only
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cleaned = {};
  for (const [d, c] of Object.entries(saveCounter)) {
    if (new Date(d) >= cutoff) cleaned[d] = c;
  }
  cleaned[today] = (cleaned[today] || 0) + 1;
  await chrome.storage.local.set({ saveCounter: cleaned });
  await updateBadge(cleaned[today]);
  return cleaned[today];
}

async function updateBadge(count) {
  try {
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' });
  } catch { /* popup context — ignore */ }
}

// ─── Export ──────────────────────────────────────────────

if (typeof globalThis !== 'undefined') {
  globalThis.memoryApi = {
    getApiUrl, getTokens, saveTokens, clearTokens, isAuthenticated,
    apiRequest, login, logout,
    createMemory, getMemoryStats, getRecentMemories,
    getOfflineQueue, addToOfflineQueue, flushOfflineQueue, smartSave,
    getTodaySaves, incrementTodaySaves, updateBadge,
  };
}
