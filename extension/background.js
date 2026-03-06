/**
 * Memory AI Extension — Background Service Worker
 * Context menus, omnibox, keyboard shortcuts, offline sync, badge.
 */

importScripts('api.js');

// ═══════════════════════════════════════════════════════════
//  INSTALL — context menus, badge init
// ═══════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({ id: 'save-selection', title: 'Save to Memory AI', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'save-page-link', title: 'Save page link to Memory AI', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'save-link', title: 'Save link to Memory AI', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'save-image', title: 'Save image to Memory AI', contexts: ['image'] });

  // Restore badge on install/update
  const count = await memoryApi.getTodaySaves();
  await memoryApi.updateBadge(count);
});

// Restore badge on browser start
chrome.runtime.onStartup.addListener(async () => {
  const count = await memoryApi.getTodaySaves();
  await memoryApi.updateBadge(count);

  // Flush offline queue when back online
  const queue = await memoryApi.getOfflineQueue();
  if (queue.length > 0) {
    const { flushed } = await memoryApi.flushOfflineQueue();
    if (flushed > 0) {
      notify('Synced!', `${flushed} queued ${flushed === 1 ? 'memory' : 'memories'} saved.`);
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  CONTEXT MENUS
// ═══════════════════════════════════════════════════════════

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!await memoryApi.isAuthenticated()) {
    await chrome.storage.local.set({
      pendingSelection: {
        text: info.selectionText || info.linkUrl || info.pageUrl,
        url: tab?.url || '', title: tab?.title || '', menuId: info.menuItemId,
      },
    });
    notify('Sign in required', 'Click the Memory AI icon to sign in first.');
    return;
  }

  try {
    const meta = { source: 'extension_context_menu', source_url: tab?.url || '', source_title: tab?.title || '' };
    switch (info.menuItemId) {
      case 'save-selection':
        if (!info.selectionText) return;
        await memoryApi.smartSave('text', info.selectionText, meta);
        feedbackToTab(tab, 'Text saved');
        break;
      case 'save-page-link':
        await memoryApi.smartSave('link', tab?.url || info.pageUrl, meta);
        feedbackToTab(tab, 'Page link saved');
        break;
      case 'save-link':
        if (!info.linkUrl) return;
        await memoryApi.smartSave('link', info.linkUrl, { ...meta, source_page: tab?.url || '' });
        feedbackToTab(tab, 'Link saved');
        break;
      case 'save-image':
        if (!info.srcUrl) return;
        await memoryApi.smartSave('photo', info.srcUrl, { ...meta, image_url: info.srcUrl });
        feedbackToTab(tab, 'Image saved');
        break;
    }
  } catch (err) {
    notify('Error', err.message || 'Failed to save memory');
  }
});

// ═══════════════════════════════════════════════════════════
//  OMNIBOX — type "mem <text>" in the address bar
// ═══════════════════════════════════════════════════════════

chrome.omnibox.onInputStarted.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: 'Save to Memory AI: type a thought, URL, or note',
  });
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const suggestions = [];
  const trimmed = text.trim();
  if (!trimmed) return;

  // Detect URL
  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    suggestions.push({
      content: `link:${trimmed}`,
      description: `Save link: <url>${xmlEscape(trimmed)}</url>`,
    });
  } else {
    suggestions.push({
      content: `text:${trimmed}`,
      description: `Save text: <match>${xmlEscape(trimmed)}</match>`,
    });
  }
  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  if (!await memoryApi.isAuthenticated()) {
    notify('Sign in required', 'Click the Memory AI icon to sign in first.');
    return;
  }

  let type = 'text';
  let content = text.trim();

  // Parse prefixed content
  if (content.startsWith('link:')) {
    type = 'link'; content = content.slice(5);
  } else if (content.startsWith('text:')) {
    content = content.slice(5);
  } else if (/^https?:\/\//i.test(content) || /^www\./i.test(content)) {
    type = 'link';
  }

  if (!content) return;

  try {
    const result = await memoryApi.smartSave(type, content, { source: 'extension_omnibox' });
    if (result?._queued) {
      notify('Queued', 'You\'re offline — memory will sync when connected.');
    } else {
      notify('Saved!', `${type === 'link' ? 'Link' : 'Note'} saved to Memory AI`);
    }
  } catch (err) {
    notify('Error', err.message || 'Failed to save');
  }
});

// ═══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════

chrome.commands.onCommand.addListener(async (command) => {
  if (!await memoryApi.isAuthenticated()) {
    notify('Sign in required', 'Click the Memory AI icon to sign in first.');
    return;
  }

  if (command === 'save-selection') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
      if (response?.text) {
        const result = await memoryApi.smartSave('text', response.text, {
          source: 'extension_shortcut',
          source_url: tab.url,
          source_title: tab.title,
        });
        if (result?._queued) {
          chrome.tabs.sendMessage(tab.id, { type: 'SHOW_FEEDBACK', message: 'Queued — will sync later' });
        } else {
          chrome.tabs.sendMessage(tab.id, { type: 'SHOW_FEEDBACK', message: 'Saved to Memory AI' });
        }
      } else {
        notify('No selection', 'Select some text first, then try again.');
      }
    } catch (err) {
      notify('Error', err.message || 'Failed to save selection');
    }
  }

  if (command === 'save-link') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      // Skip chrome:// and other internal pages
      if (tab.url.startsWith('chrome') || tab.url.startsWith('about:')) {
        notify('Cannot save', 'Cannot save internal browser pages.');
        return;
      }

      // Try to get rich page metadata from content script
      let meta = { source: 'extension_shortcut', source_url: tab.url, source_title: tab.title };
      try {
        const pageMeta = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_META' });
        if (pageMeta) {
          if (pageMeta.title) meta.link_title = pageMeta.title;
          if (pageMeta.description) meta.link_description = pageMeta.description;
          if (pageMeta.image) meta.link_image = pageMeta.image;
          if (pageMeta.favicon) meta.link_favicon = pageMeta.favicon;
        }
      } catch { /* content script may not be loaded */ }

      const result = await memoryApi.smartSave('link', tab.url, meta);
      if (result?._queued) {
        feedbackToTab(tab, 'Link queued — will sync later');
      } else {
        feedbackToTab(tab, 'Page link saved to Memory AI');
      }
    } catch (err) {
      notify('Error', err.message || 'Failed to save link');
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  MESSAGE HANDLING (from popup / content scripts)
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'SAVE_MEMORY') {
    (async () => {
      if (!await memoryApi.isAuthenticated()) throw new Error('Not authenticated');
      return memoryApi.smartSave(msg.memoryType || 'text', msg.content, msg.metadata || {});
    })().then(r => reply({ success: true, data: r })).catch(e => reply({ success: false, error: e.message }));
    return true;
  }
  if (msg.type === 'CHECK_AUTH') {
    memoryApi.isAuthenticated().then(a => reply({ authenticated: a })).catch(() => reply({ authenticated: false }));
    return true;
  }
  if (msg.type === 'FLUSH_QUEUE') {
    memoryApi.flushOfflineQueue().then(r => reply(r)).catch(e => reply({ error: e.message }));
    return true;
  }
  if (msg.type === 'GET_PAGE_META') {
    // Forwarded to content script — no handling here
    return false;
  }
});

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic', iconUrl: 'icons/icon128.png', title, message, silent: false,
  });
}

async function feedbackToTab(tab, message) {
  try {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'SHOW_FEEDBACK', message });
  } catch { /* content script may not be loaded */ }
}

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
