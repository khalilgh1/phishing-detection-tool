/**
 * gmail.js  —  Gmail Email Extraction & Parsing Module
 *
 * Extracts email header (sender, subject) and body snippet from
 * the Gmail web UI DOM.  Gmail obfuscates its class names, so we
 * use MULTIPLE fallback selectors and attribute-based queries.
 *
 * Exposed globally as `GmailModule`.
 */

// eslint-disable-next-line no-var
var GmailModule = (function () {
    "use strict";

    // ── Multiple selector strategies per field.
    //    Gmail changes class names between updates, so we try several. ──

    /** Selectors tried IN ORDER for the email sender */
    const SENDER_SELECTORS = [
        'span[email]',                       // <span email="user@gmail.com">
        '[data-hovercard-id]',               // hovercard on sender chip
        'span.gD',                           // sender name span (classic)
        'span.go',                           // sender in collapsed view
        'table.cf > tbody span[email]',      // inside header table
        '.qu > .gD',                         // another sender variant
    ];

    /** Selectors tried IN ORDER for the email subject */
    const SUBJECT_SELECTORS = [
        'h2[data-thread-perm-id]',           // thread subject heading
        '.hP',                                // subject bar
        'h2.hP',                              // subject heading variant
        'input[name="subject"]',             // compose view (for testing)
        'div[data-thread-perm-id]',          // newer variant
        'span[data-thread-perm-id]',         // another variant
    ];

    /** Selectors tried IN ORDER for the email body */
    const BODY_SELECTORS = [
        '.a3s.aiL',                           // expanded message body
        '.a3s',                                // body without aiL
        'div[data-message-id] .a3s',          // scoped to message
        '.ii.gt div.a3s',                      // inner body container
        '.ii.gt',                              // fallback: entire message card
        'div[role="listitem"] .a3s',           // in message list context
    ];

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────

    /**
     * Extract email from the currently visible Gmail page.
     * Returns header info + body snippet.
     *
     * @returns {{ header: object, bodySnippet: string }}
     */
    function extractFromPage() {
        const header = _extractHeader();
        const bodySnippet = _extractBodySnippet();
        return { header, bodySnippet };
    }

    /**
     * Parse raw email text (for testing without a real Gmail page).
     *
     * @param {string} rawText
     * @returns {{ header: object, bodySnippet: string }}
     */
    function parseRawEmail(rawText) {
        if (!rawText || typeof rawText !== "string") {
            throw new Error("parseRawEmail: empty or invalid input.");
        }
        const lines = rawText.split("\n");
        const header = {};
        let bodyStartIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "") { bodyStartIndex = i + 1; break; }
            const colonIdx = line.indexOf(":");
            if (colonIdx > 0) {
                header[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
            }
        }
        return { header, bodySnippet: _snippetize(lines.slice(bodyStartIndex).join("\n")) };
    }

    /**
     * Placeholder for future analysis logic.
     */
    function analyse(emailData) {
        return {
            suspiciousLinks: [],
            senderTrusted: null,
            riskScore: null,
            _note: "Analysis not yet implemented — placeholder.",
        };
    }

    // ──────────────────────────────────────────────
    // Internal Helpers
    // ──────────────────────────────────────────────

    function _extractHeader() {
        const from = _trySelectors(SENDER_SELECTORS, _getEmail) || "Unknown sender";
        const subject = _trySelectors(SUBJECT_SELECTORS) || "No subject";
        return { from, subject };
    }

    function _extractBodySnippet() {
        for (const selector of BODY_SELECTORS) {
            const el = document.querySelector(selector);
            if (el && el.innerText.trim().length > 0) {
                return _snippetize(el.innerText);
            }
        }
        return "(Could not locate email body in the DOM)";
    }

    /**
     * Try multiple selectors in order.  Returns the first non-empty text.
     * @param {string[]} selectors
     * @param {Function} [extractor]  Optional custom extractor (receives element).
     */
    function _trySelectors(selectors, extractor) {
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (!el) continue;
                const text = extractor ? extractor(el) : el.innerText.trim();
                if (text) return text;
            } catch { /* skip bad selector */ }
        }
        return null;
    }

    /**
     * Extract email address from a sender element.
     * Prefers the `email` attribute, then falls back to innerText.
     */
    function _getEmail(el) {
        return el.getAttribute("email") || el.getAttribute("data-hovercard-id") || el.innerText.trim();
    }

    function _snippetize(text, maxLen = Number.POSITIVE_INFINITY) {
        const clean = text.trim();
        if (clean.length <= maxLen) return clean;
        return clean.slice(0, maxLen) + "… [truncated]";
    }

    // ──────────────────────────────────────────────
    return {
        extractFromPage,
        parseRawEmail,
        analyse,
    };
})();
