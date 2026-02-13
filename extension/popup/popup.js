/**
 * popup.js  —  Osprey Popup Status Display
 *
 * Shows the extension's current status on the active page.
 * All detection logic runs in the content script automatically.
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
        console.error("[Osprey] Init error:", err);
    }
});

// ──────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────

function renderStatus(tabInfo) {
    if (!tabInfo?.url) {
        setStatus("No URL detected", "");
        setInfo("Navigate to Gmail to begin automatic phishing detection.");
        return;
    }

    if (tabInfo.url.startsWith(GMAIL_ORIGIN)) {
        setStatus("Gmail Active", "gmail");
        setInfo(
            "Osprey is monitoring Gmail.\n\n" +
            "Open an email to automatically scan it for phishing.\n" +
            "Results appear in a floating overlay on the page."
        );
    } else {
        setStatus("Inactive", "other");
        setInfo(
            "Osprey works on Gmail.\n\n" +
            "Navigate to mail.google.com to start\nscanning emails for phishing threats."
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
