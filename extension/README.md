# DukiAI Memory — Chrome Extension

Save thoughts, links, and text snippets to DukiAI Memory instantly from your browser.

## Features

| Feature | Description |
|---|---|
| **⌘M Quick Capture** | Open popup from any tab with `⌘M` (Mac) / `Ctrl+M` (Win/Linux) |
| **⌘⇧S Save Selection** | Highlight text and save it instantly — no popup needed |
| **Omnibox** | Type `mem` in the address bar, then your note or URL |
| **Right-click Menu** | Save selected text, page links, hyperlinks, or images |
| **Smart Detection** | Auto-detects selected text, clipboard URLs, page metadata |
| **Offline Queue** | Saves queued when offline, auto-syncs when reconnected |
| **Badge Counter** | Shows how many memories you've saved today |
| **Page Metadata** | Captures OG title, description, favicon for saved links |

## Installation

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** and select this `extension/` folder
4. Pin the extension for easy access

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘M` / `Ctrl+M` | Open Quick Capture popup |
| `⌘⇧S` / `Ctrl+Shift+S` | Save selected text from any page |
| `⌘⇧L` / `Ctrl+Shift+L` | Save current page as a link |
| `⌘↵` / `Ctrl+Enter` | Save memory (in popup) |
| `⌥1` / `Alt+1` | Switch to Text tab (in popup) |
| `⌥2` / `Alt+2` | Switch to Link tab (in popup) |
| `⌥3` / `Alt+3` | Switch to Selection tab (in popup) |
| `Esc` | Close popup |

> **Note**: `⌘M` may conflict with macOS "Minimize Window". You can reassign shortcuts at `chrome://extensions/shortcuts`.

## Omnibox

Type `mem` in the Chrome address bar, press `Tab`, then type your note or paste a URL:

```
mem Remember to buy groceries          → saves as text
mem https://example.com/article        → saves as link
```

## Configuration

Click the **Settings** icon in the popup or go to the extension options page:

- **API URL** — Point to your DukiAI Memory server (default: `http://localhost:8000`)
- **Language** — English or Tiếng Việt

## Architecture

```
extension/
├── manifest.json      Manifest V3 configuration
├── api.js             Shared API: auth, CRUD, offline queue, badge
├── background.js      Service worker: menus, omnibox, shortcuts, sync
├── content.js         Content script: selection, metadata, toast feedback
├── popup.html/css/js  Quick Capture popup UI
├── options.html/css/js Settings page
├── icons/             Extension icons (16–128px)
└── validate.py        Validation script
```

## Files

- **api.js** — Auth (login/logout/refresh), memory CRUD, `smartSave()` with offline fallback, badge counter, offline queue flush
- **background.js** — Context menus (selection, page link, link, image), omnibox handler, keyboard shortcut handler, message routing
- **content.js** — Page metadata extraction (OG/Twitter/favicon/canonical), selected text capture, Shadow DOM toast feedback
- **popup.js** — Smart tab switching (auto-detects context), clipboard banner, character count, recent memories, offline status

## Requirements

- Chrome 110+ (Manifest V3)
- DukiAI Memory backend running (see main project README)
