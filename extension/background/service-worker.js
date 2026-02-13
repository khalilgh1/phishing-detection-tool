/**
 * service-worker.js  —  Osprey Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  1. Listen for messages from content scripts.
 *  2. Forward email text to the backend API for phishing prediction.
 *  3. Provide tab info for the popup.
 */

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const API_BASE_URL = "http://localhost:5000/api";

// ──────────────────────────────────────────────
// Message Router
// ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    switch (type) {
        case "PREDICT_EMAIL": {
            handlePredictEmail(payload, sendResponse);
            return true; // async response
        }

        case "GET_TAB_INFO":
            handleGetTabInfo(sendResponse);
            return true;

        default:
            console.warn(`[Osprey SW] Unknown message type: ${type}`);
            sendResponse({ success: false, error: "Unknown message type" });
            return false;
    }
});

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Send email text to the backend for phishing prediction.
 */
async function handlePredictEmail(payload, sendResponse) {
    try {
        const { text } = payload;
        if (!text) throw new Error("No email text provided.");

        console.log("[Osprey SW] Sending email to backend for prediction…");

        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Backend returned ${response.status}: ${errBody}`);
        }

        const result = await response.json();
        console.log("[Osprey SW] Prediction result:", result);
        sendResponse({ success: true, result });
    } catch (error) {
        console.error("[Osprey SW] Prediction failed:", error);
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
        console.error("[Osprey SW] Failed to get tab info:", error);
        sendResponse({ success: false, error: error.message });
    }
}
