# Phishing Detection Tool — Chrome Extension

A modular Chrome extension skeleton for phishing detection research. Demonstrates **Gmail email analysis** and **page screenshot capture** with a clean, extensible architecture.

> **⚠ Research / educational use only.** This is a proof-of-concept, not a production security tool.

---

## Quick Start

1. Open **Chrome** → navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select the `extension/` folder.
4. The extension icon appears in the toolbar — click it to open the popup.

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| Gmail detection | ✅ Working | Detects `mail.google.com`; extracts email header + body snippet |
| Manual email input | ✅ Working | Paste raw email text in the popup for quick testing |
| Page screenshot | ✅ Working | Captures visible tab as PNG via `chrome.tabs.captureVisibleTab` |
| Draggable overlay | ✅ Working | Displays the screenshot in a floating, draggable panel on the page |
| CV analysis | 🔲 Placeholder | `ScreenshotModule.analyse()` ready for computer-vision logic |
| Link scanning | 🔲 Placeholder | `GmailModule.analyse()` ready for suspicious-link detection |

---

## File Structure

```
extension/
├── manifest.json                  # MV3 manifest
├── icons/                         # Extension icons (replace with real PNGs)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── service-worker.js          # Background service worker (screenshot capture, tab info)
├── popup/
│   ├── popup.html                 # Popup UI markup
│   ├── popup.css                  # Popup styles (separated from logic)
│   └── popup.js                   # Popup controller (sends messages, no analysis logic)
└── content/
    ├── content.js                 # Content-script router (detects page type, delegates)
    ├── overlay.css                # Overlay styles (injected into host page)
    └── modules/
        ├── utils.js               # Shared helpers (DOM queries, debounce, etc.)
        ├── gmail.js               # Gmail extraction & parsing module
        ├── screenshot.js          # Screenshot analysis module (CV placeholder)
        └── overlay-ui.js          # Draggable overlay DOM component
```

---

## Architecture

```
┌──────────┐   messages    ┌──────────────────┐   messages    ┌───────────────────┐
│  Popup   │ ◄──────────► │  Service Worker   │ ◄──────────► │  Content Script   │
│  (UI)    │               │  (background)     │               │  (router)         │
└──────────┘               └──────────────────┘               ├───────────────────┤
                                                               │ GmailModule       │
                                                               │ ScreenshotModule  │
                                                               │ OverlayUI         │
                                                               │ Utils             │
                                                               └───────────────────┘
```

- **Popup** handles UI only — no analysis logic.
- **Service Worker** handles Chrome API calls (screenshots, tab queries).
- **Content Script** runs on every page and delegates to modular handlers.
- **Modules** are independently testable IIFE modules with clear public APIs.

---

## Extending

### Add a new page-type detector
Edit `detectPageType()` in `content/content.js`:
```js
if (url.startsWith("https://outlook.live.com")) return "outlook";
```

### Add CV screenshot analysis
Implement logic inside `ScreenshotModule.analyse()` in `content/modules/screenshot.js`.

### Add suspicious-link scanning
Implement logic inside `GmailModule.analyse()` in `content/modules/gmail.js`.

---

## Icons

The current icons are SVG placeholders saved as `.png`. Replace them with real 16×16, 48×48, and 128×128 PNG files for a polished look.

---

## License

MIT — use freely for research and learning.