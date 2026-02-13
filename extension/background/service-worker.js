/**
 * service-worker.js  —  Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  1. Listen for messages from content scripts.
 *  2. Capture visible-tab screenshots via chrome.tabs API.
 *  3. Automatically trigger screenshot capture when a non-Gmail tab
 *     finishes loading (via chrome.tabs.onUpdated).
 *
 * This file stays thin — it only handles Chrome API calls that
 * content scripts cannot access directly.
 */

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const GMAIL_ORIGIN = "https://mail.google.com";

// ──────────────────────────────────────────────
// Auto-trigger: capture screenshot when a non-Gmail page loads
// ──────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only act when the page has fully loaded
    if (changeInfo.status !== "complete") return;

    // Skip Gmail pages — those are handled by the content script's Gmail logic
    if (tab.url && tab.url.startsWith(GMAIL_ORIGIN)) return;

    // Skip chrome:// and edge:// internal pages (cannot capture or inject into them)
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://")) return;

    console.log(`[service-worker] Non-Gmail page loaded (tab ${tabId}), auto-capturing screenshot…`);

    // Small delay to ensure the page is visually rendered
    setTimeout(() => {
        captureAndNotify(tabId, tab.windowId);
    }, 1500);
});

/**
 * Capture the visible tab and send the result to the content script.
 */
async function captureAndNotify(tabId, windowId) {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
            format: "png",
        });

        // Send the screenshot to the content script running in that tab
        chrome.tabs.sendMessage(tabId, {
            type: "SCREENSHOT_CAPTURED",
            payload: { dataUrl },
        });

        console.log(`[service-worker] Screenshot sent to tab ${tabId}`);
    } catch (error) {
        console.error("[service-worker] Auto-capture failed:", error.message);
    }
}

// ──────────────────────────────────────────────
// Message Router (for on-demand requests from content scripts)
// ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type } = message;

    switch (type) {
        case "CAPTURE_SCREENSHOT": {
            // Content script is requesting a screenshot of its own tab
            const windowId = sender.tab?.windowId;
            if (!windowId) {
                // Fallback: query for the active tab's window
                handleCaptureScreenshotFallback(sendResponse);
            } else {
                handleCaptureScreenshot(windowId, sendResponse);
            }
            return true; // async response
        }

        case "GET_TAB_INFO":
            handleGetTabInfo(sendResponse);
            return true;

        case "DOWNLOAD_FILE": {
            // Content script wants to auto-download a file (.txt or .png)
            const { dataUrl, filename } = message.payload || {};
            handleDownloadFile(dataUrl, filename, sendResponse);
            return true; // async response
        }

        default:
            console.warn(`[service-worker] Unknown message type: ${type}`);
            sendResponse({ success: false, error: "Unknown message type" });
            return false;
    }
});

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Capture a screenshot of the specified window.
 * Returns a base-64 data-URL string (PNG).
 */
async function handleCaptureScreenshot(windowId, sendResponse) {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
            format: "png",
        });
        sendResponse({ success: true, dataUrl });
    } catch (error) {
        console.error("[service-worker] Screenshot capture failed:", error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Fallback: find the current window and capture.
 */
async function handleCaptureScreenshotFallback(sendResponse) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab found.");
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png",
        });
        sendResponse({ success: true, dataUrl });
    } catch (error) {
        console.error("[service-worker] Screenshot fallback failed:", error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Return basic information about the active tab (URL, title).
 * Used by the popup to show current status.
 */
async function handleGetTabInfo(sendResponse) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab found.");

        sendResponse({
            success: true,
            tabInfo: {
                url: tab.url,
                title: tab.title,
                id: tab.id,
            },
        });
    } catch (error) {
        console.error("[service-worker] Failed to get tab info:", error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Download a file using the chrome.downloads API.
 * Accepts a data URL (base-64) and a suggested filename.
 *
 * @param {string} dataUrl   The data URL to save (text/plain or image/png).
 * @param {string} filename  Suggested filename (e.g. "gmail_extracted_2024-01-01.txt").
 * @param {Function} sendResponse  Callback to the content script.
 */
async function handleDownloadFile(dataUrl, filename, sendResponse) {
    try {
        if (!dataUrl || !filename) {
            throw new Error("Missing dataUrl or filename for download.");
        }

        const downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false,       // save silently to the default Downloads folder
            conflictAction: "uniquify",  // append (1), (2), etc. if file exists
        });

        console.log(`[service-worker] Download started: ${filename} (id: ${downloadId})`);
        sendResponse({ success: true, downloadId });
    } catch (error) {
        console.error("[service-worker] Download failed:", error);
        sendResponse({ success: false, error: error.message });
    }
}
