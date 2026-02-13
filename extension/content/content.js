/**
 * content.js  —  Osprey Content Script (Gmail Only)
 *
 * Injected into Gmail pages. It:
 *   1. Monitors URL hash for email-open pattern (#inbox/<id>),
 *      re-triggers on every SPA navigation.
 *   2. Extracts sender, subject, and body from the Gmail DOM.
 *   3. Sends the email text to the backend via the service worker.
 *   4. Displays the phishing detection result in a branded overlay.
 *
 * Modules loaded via manifest "js" array (order matters):
 *   Utils → GmailModule → OverlayUI → this file
 */

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const CONFIG = {
    gmailOrigin: "https://mail.google.com",
    debug: true,
};

function log(...args) {
    if (CONFIG.debug) console.log("[Osprey]", ...args);
}
function warn(...args) {
    console.warn("[Osprey]", ...args);
}

// ──────────────────────────────────────────────
// Gmail URL Detection
// ──────────────────────────────────────────────

/**
 * Check if the current Gmail URL indicates a specific email is open.
 */
function isGmailEmailOpen() {
    const hash = window.location.hash;
    if (!hash) return false;
    const emailOpenPattern = /^#(?:inbox|sent|starred|drafts|trash|spam|all|label\/[^/]+)\/[A-Za-z0-9_-]{10,}$/;
    return emailOpenPattern.test(hash);
}

/**
 * Extract the email/thread ID from the current Gmail URL hash.
 */
function getGmailEmailId() {
    const hash = window.location.hash;
    if (!hash) return null;
    const match = hash.match(/\/([A-Za-z0-9_-]{10,})$/);
    return match ? match[1] : null;
}

// ──────────────────────────────────────────────
// Backend Communication
// ──────────────────────────────────────────────

/**
 * Send email text to the backend via the service worker for prediction.
 * @param {string} emailText  Formatted email string (sender + subject + body)
 * @returns {Promise<object>}  Prediction result from the backend
 */
function predictEmail(emailText) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: "PREDICT_EMAIL", payload: { text: emailText } },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response?.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || "Prediction failed"));
                }
            }
        );
    });
}

// ──────────────────────────────────────────────
// Gmail: SPA URL Change Detection + Email Extraction
// ──────────────────────────────────────────────

/** The email/thread ID from the last processed URL. */
let lastProcessedEmailId = "";

/** Fingerprint of the last processed email (avoids duplicate overlays). */
let lastEmailFingerprint = "";

/**
 * Start monitoring Gmail for email opens.
 */
function startGmailWatcher() {
    log("Starting Gmail SPA watcher…");

    // 1. Listen for hash changes (primary SPA navigation detection)
    window.addEventListener("hashchange", () => {
        log("hashchange detected:", window.location.hash);
        onGmailNavigation();
    });

    // 2. URL polling fallback
    let lastUrl = window.location.href;
    setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            log("URL change detected (poll):", currentUrl);
            lastUrl = currentUrl;
            onGmailNavigation();
        }
    }, 1000);

    // 3. MutationObserver for DOM readiness after navigation
    const debouncedDomCheck = Utils.debounce(() => {
        if (isGmailEmailOpen()) {
            tryExtractAndPredict();
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

    // 4. Initial check (page may have loaded directly on an email URL)
    setTimeout(() => onGmailNavigation(), 2000);
    setTimeout(() => onGmailNavigation(), 5000);
}

/**
 * Called whenever Gmail navigates.
 */
function onGmailNavigation() {
    if (!isGmailEmailOpen()) {
        log("Not on a specific email — skipping.");
        return;
    }

    const emailId = getGmailEmailId();
    if (emailId === lastProcessedEmailId) {
        log("Same email ID already processed — skipping.");
        return;
    }

    log(`New email opened: ${emailId}`);
    lastEmailFingerprint = "";
    lastProcessedEmailId = emailId;

    // Delay to let Gmail render the email DOM
    setTimeout(() => tryExtractAndPredict(), 1500);
    setTimeout(() => tryExtractAndPredict(), 3000);
}

/**
 * Extract email from the Gmail DOM, send to backend, and show result.
 */
async function tryExtractAndPredict() {
    if (!isGmailEmailOpen()) {
        log("No longer on an email URL — aborting.");
        return;
    }

    const emailData = GmailModule.extractFromPage();
    log("Extraction attempt:", JSON.stringify(emailData, null, 2));

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

    // Fingerprint to avoid re-processing the same email
    const fingerprint = `${subject}|${from}|${body.slice(0, 80)}`;
    if (fingerprint === lastEmailFingerprint) return;
    lastEmailFingerprint = fingerprint;

    log("New email content extracted — sending to backend…");

    // Format email text for the model: sender + subject + body
    const emailText = `${from} ${subject} ${body}`;

    // Show loading state
    OverlayUI.showLoading(from, subject);

    try {
        const result = await predictEmail(emailText);
        log("Prediction result:", result);

        // Show result in the overlay
        OverlayUI.showResult({
            from,
            subject,
            bodyPreview: Utils.truncate(body, 120),
            label: result.label_name,
            confidence: result.confidence,
            probabilities: result.probabilities,
        });
    } catch (error) {
        warn("Prediction error:", error.message);
        OverlayUI.showError(from, subject, error.message);
    }
}

// ──────────────────────────────────────────────
// Auto-init
// ──────────────────────────────────────────────

(function init() {
    log(`Osprey active — ${window.location.href}`);
    startGmailWatcher();
})();
