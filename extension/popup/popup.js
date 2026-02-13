/**
 * popup.js  —  Popup Status Display (Fully Automatic Extension)
 *
 * The popup is now purely informational — it shows what the
 * extension is doing on the current page. All detection and
 * capture logic runs automatically in the content script and
 * background service worker.
 */

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────

const dom = {
    status: document.getElementById("status"),
    infoText: document.getElementById("info-text"),
};

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const GMAIL_ORIGIN = "https://mail.google.com";

// ──────────────────────────────────────────────
// Initialisation
// ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await sendMessage("GET_TAB_INFO");
        if (response?.success) {
            renderStatus(response.tabInfo);
        } else {
            setStatus("Could not detect page.", "");
            setInfo("Extension could not read the current tab.");
        }
    } catch (err) {
        setStatus("Error", "");
        setInfo("Something went wrong while detecting the page.");
        console.error("[popup] Init error:", err);
    }
});

// ──────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────

function renderStatus(tabInfo) {
    if (!tabInfo?.url) {
        setStatus("No URL detected", "");
        setInfo("Navigate to a website to begin automatic detection.");
        return;
    }

    if (tabInfo.url.startsWith(GMAIL_ORIGIN)) {
        setStatus("Gmail detected", "gmail");
        setInfo(
            "Monitoring Gmail for opened emails.\n" +
            "When you open an email, the extension will automatically extract " +
            "header and body snippets and display them in a floating overlay."
        );
    } else {
        setStatus("Screenshot mode", "other");
        setInfo(
            "A screenshot of this page was automatically captured.\n" +
            "A floating overlay on the page confirms success.\n\n" +
            "Page: " + truncate(tabInfo.url, 60)
        );
    }
}

// ──────────────────────────────────────────────
// Messaging Helper
// ──────────────────────────────────────────────

function sendMessage(type, payload = {}) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
            resolve(response);
        });
    });
}

// ──────────────────────────────────────────────
// UI Helpers
// ──────────────────────────────────────────────

function setStatus(text, variant) {
    dom.status.textContent = text;
    dom.status.className = `status ${variant || ""}`.trim();
}

function setInfo(text) {
    dom.infoText.textContent = text;
}

function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + "\u2026" : str;
}
