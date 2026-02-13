/**
 * content.js  —  Content Script Router (Fully Automatic)
 *
 * Injected into every page. It:
 *   1. Detects page type (Gmail vs other).
 *   2. Gmail → monitors URL hash for email-open pattern (#inbox/<id>),
 *      re-triggers on every SPA navigation, extracts header + body,
 *      auto-downloads as .txt, shows overlay confirmation.
 *   3. Other → requests screenshot from background, auto-downloads
 *      as .png, shows the captured image in a draggable overlay.
 *
 * Everything is automatic — no buttons, no user input.
 *
 * Modules loaded via manifest "js" array (order matters):
 *   Utils → GmailModule → ScreenshotModule → OverlayUI → this file
 */

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const CONFIG = {
    gmailOrigin: "https://mail.google.com",
    debug: true,
};

function log(...args) {
    if (CONFIG.debug) console.log("[content]", ...args);
}
function warn(...args) {
    console.warn("[content]", ...args);
}

// ──────────────────────────────────────────────
// Page-type Detection
// ──────────────────────────────────────────────

function detectPageType() {
    const url = window.location.href;
    if (url.startsWith(CONFIG.gmailOrigin)) return "gmail";
    return "other";
}

// ──────────────────────────────────────────────
// Gmail URL Detection
// ──────────────────────────────────────────────

/**
 * Check if the current Gmail URL indicates a specific email is open.
 * Gmail email URLs look like:
 *   https://mail.google.com/mail/u/0/#inbox/FMfcgzQXKNpKmWCrzDlrFTVHqjQSMkfB
 *   https://mail.google.com/mail/u/0/#sent/FMfcg...
 *   https://mail.google.com/mail/u/0/#label/Work/FMfcg...
 *
 * The key is that after #inbox/ (or #sent/, #label/Name/, etc.)
 * there is an email/thread ID (a long alphanumeric string).
 *
 * This must NOT match:
 *   https://mail.google.com/mail/u/0/#inbox  (no email ID — just the list)
 */
function isGmailEmailOpen() {
    const hash = window.location.hash; // e.g. "#inbox/FMfcg..."
    if (!hash) return false;

    // Match: #inbox/XXXXX, #sent/XXXXX, #starred/XXXXX, #label/Name/XXXXX, etc.
    // The email/thread ID is typically 15+ alphanumeric characters.
    const emailOpenPattern = /^#(?:inbox|sent|starred|drafts|trash|spam|all|label\/[^/]+)\/[A-Za-z0-9_-]{10,}$/;
    return emailOpenPattern.test(hash);
}

/**
 * Extract the email/thread ID from the current Gmail URL hash.
 * Returns null if no email is open.
 */
function getGmailEmailId() {
    const hash = window.location.hash;
    if (!hash) return null;
    const match = hash.match(/\/([A-Za-z0-9_-]{10,})$/);
    return match ? match[1] : null;
}

// ──────────────────────────────────────────────
// Message Listener (from background service worker)
// ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;
    log("Received message:", type);

    switch (type) {
        case "SCREENSHOT_CAPTURED":
            handleScreenshotCaptured(payload);
            sendResponse({ success: true });
            return false;

        default:
            sendResponse({ success: false, error: `Unknown type: ${type}` });
            return false;
    }
});

// ──────────────────────────────────────────────
// Auto-download helpers
// ──────────────────────────────────────────────

/**
 * Ask the background service worker to download a file using
 * chrome.downloads.download().
 *
 * @param {string} dataUrl  Base-64 data URL of the content.
 * @param {string} filename Suggested filename (e.g. "gmail_1234.txt").
 */
function triggerDownload(dataUrl, filename) {
    chrome.runtime.sendMessage(
        { type: "DOWNLOAD_FILE", payload: { dataUrl, filename } },
        (response) => {
            if (chrome.runtime.lastError) {
                warn("Download request failed:", chrome.runtime.lastError.message);
                return;
            }
            if (response?.success) {
                log(`Download started: ${filename}`);
            } else {
                warn("Download failed:", response?.error);
            }
        }
    );
}

/**
 * Build a timestamped filename.
 * @param {string} prefix  e.g. "gmail_extracted"
 * @param {string} ext     e.g. "txt"
 */
function makeFilename(prefix, ext) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `${prefix}_${ts}.${ext}`;
}

/**
 * Convert a plain-text string to a text/plain data URL.
 */
function textToDataUrl(text) {
    return "data:text/plain;base64," + btoa(unescape(encodeURIComponent(text)));
}

// ──────────────────────────────────────────────
// Screenshot Logic (non-Gmail pages)
// ──────────────────────────────────────────────

/**
 * Actively request a screenshot from the background service worker.
 * On success: shows overlay with image, auto-downloads as .png.
 */
function requestScreenshot() {
    log("Requesting screenshot from background…");

    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
        if (chrome.runtime.lastError) {
            warn("Screenshot request failed:", chrome.runtime.lastError.message);
            OverlayUI.showMessage("Screenshot capture failed:\n" + chrome.runtime.lastError.message);
            return;
        }

        if (response?.success && response.dataUrl) {
            log("Screenshot received (" + Math.round(response.dataUrl.length / 1024) + " KB)");

            // Show overlay with the screenshot image
            OverlayUI.showScreenshot(response.dataUrl);

            // Auto-download the screenshot as a .png file
            const filename = makeFilename("screenshot", "png");
            triggerDownload(response.dataUrl, filename);
            log("Auto-download triggered:", filename);
        } else {
            warn("Screenshot response unsuccessful:", response);
            OverlayUI.showMessage("Screenshot capture failed:\n" + (response?.error || "Unknown error"));
        }
    });
}

/**
 * Handle a screenshot pushed from the background (fallback path).
 */
function handleScreenshotCaptured(payload) {
    if (!payload?.dataUrl) {
        warn("Screenshot message received but no dataUrl.");
        return;
    }
    log("Screenshot pushed from background, showing overlay.");
    OverlayUI.showScreenshot(payload.dataUrl);

    // Auto-download the pushed screenshot too
    const filename = makeFilename("screenshot", "png");
    triggerDownload(payload.dataUrl, filename);
}

// ──────────────────────────────────────────────
// Gmail: SPA URL Change Detection + Email Extraction
// ──────────────────────────────────────────────

/** The email/thread ID from the last processed URL (avoids duplicate processing). */
let lastProcessedEmailId = "";

/** Fingerprint of the last processed email (avoids duplicate overlays). */
let lastEmailFingerprint = "";

/**
 * Start monitoring Gmail for email opens.
 * Uses a combination of:
 *  - hashchange event (Gmail uses hash-based routing)
 *  - URL polling fallback (some Gmail navigations don't fire hashchange)
 *  - MutationObserver (DOM changes after URL change)
 */
function startGmailWatcher() {
    log("Starting Gmail SPA watcher…");

    // ── 1. Listen for hash changes (primary SPA navigation detection)
    window.addEventListener("hashchange", () => {
        log("hashchange detected:", window.location.hash);
        onGmailNavigation();
    });

    // ── 2. URL polling fallback (catches navigations that don't fire hashchange)
    let lastUrl = window.location.href;
    setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            log("URL change detected (poll):", currentUrl);
            lastUrl = currentUrl;
            onGmailNavigation();
        }
    }, 1000);

    // ── 3. MutationObserver for DOM readiness after navigation
    const debouncedDomCheck = Utils.debounce(() => {
        if (isGmailEmailOpen()) {
            tryExtractEmail();
        }
    }, 1000);

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                debouncedDomCheck();
                break;
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ── 4. Initial check (in case the page loaded directly on an email URL)
    setTimeout(() => onGmailNavigation(), 2000);
    setTimeout(() => onGmailNavigation(), 5000);
}

/**
 * Called whenever Gmail navigates (hash change or URL poll).
 * Only triggers extraction if a specific email is open.
 */
function onGmailNavigation() {
    if (!isGmailEmailOpen()) {
        log("Not on a specific email (inbox/list view) — skipping extraction.");
        return;
    }

    const emailId = getGmailEmailId();
    if (emailId === lastProcessedEmailId) {
        log("Same email ID already processed — skipping.");
        return;
    }

    log(`New email opened: ${emailId}`);

    // Reset fingerprint so the new email can be processed even if
    // subject/body happen to be identical to the previous one
    lastEmailFingerprint = "";
    lastProcessedEmailId = emailId;

    // Delay to let Gmail render the email DOM
    setTimeout(() => tryExtractEmail(), 1500);
    setTimeout(() => tryExtractEmail(), 3000);
}

/**
 * Try to extract the currently visible email from the Gmail DOM.
 * If a new email is detected, show overlay confirmation + auto-download .txt.
 */
function tryExtractEmail() {
    // Double-check we're still on an email URL (user may have navigated away)
    if (!isGmailEmailOpen()) {
        log("No longer on an email URL — aborting extraction.");
        return;
    }

    const emailData = GmailModule.extractFromPage();

    log("Extraction attempt:", JSON.stringify(emailData, null, 2));

    // Determine if we got anything meaningful at all
    const from = emailData.header.from || "";
    const subject = emailData.header.subject || "";
    const body = emailData.bodySnippet || "";

    const hasFrom = from !== "" && from !== "Unknown sender";
    const hasSubject = subject !== "" && subject !== "No subject";
    const hasBody = body !== "" && !body.startsWith("(Could not");

    // Need at least ONE real piece of data
    if (!hasFrom && !hasSubject && !hasBody) {
        log("No meaningful email data found yet.");
        return;
    }

    // Fingerprint to avoid re-showing the same email
    const fingerprint = `${subject}|${from}|${body.slice(0, 80)}`;
    if (fingerprint === lastEmailFingerprint) return;
    lastEmailFingerprint = fingerprint;

    log("New email content extracted!");

    // ── Build the full text output for download ──
    const fullText =
        "=== Gmail Email Extraction ===\n" +
        "Extracted at: " + new Date().toISOString() + "\n" +
        "URL: " + window.location.href + "\n\n" +
        "From: " + from + "\n" +
        "Subject: " + subject + "\n\n" +
        "--- Body ---\n" +
        body + "\n";

    // ── Auto-download as .txt ──
    const filename = makeFilename("gmail_extracted", "txt");
    const dataUrl = textToDataUrl(fullText);
    triggerDownload(dataUrl, filename);
    log("Auto-download triggered:", filename);

    // ── Show overlay confirmation ──
    const headerLine = hasSubject ? subject : from;
    const bodyLine = hasBody ? Utils.truncate(body, 150) : "(body not available)";

    const overlayText =
        "Gmail content saved successfully.\n\n" +
        "From: " + from + "\n" +
        "Subject: " + headerLine + "\n" +
        "Body: " + bodyLine + "\n\n" +
        "File: " + filename;

    OverlayUI.showMessage(overlayText);
}

// ──────────────────────────────────────────────
// Auto-init
// ──────────────────────────────────────────────

(function init() {
    const pageType = detectPageType();
    log(`Page type: ${pageType} — ${window.location.href}`);

    if (pageType === "gmail") {
        startGmailWatcher();
    } else {
        // Request screenshot from background (content script pulls, not background pushes)
        // Delay slightly to ensure the page is visually rendered
        setTimeout(() => requestScreenshot(), 2000);
    }
})();
