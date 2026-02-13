/**
 * utils.js  —  Shared Utility Functions
 *
 * Small, reusable helpers used across content-script modules.
 * Exposed globally as `Utils`.
 */

// eslint-disable-next-line no-var
var Utils = (function () {
    "use strict";

    /**
     * Safely query a DOM element; returns null instead of throwing.
     *
     * @param {string} selector  CSS selector.
     * @param {Element} [root=document]
     * @returns {Element|null}
     */
    function qs(selector, root = document) {
        try {
            return root.querySelector(selector);
        } catch {
            return null;
        }
    }

    /**
     * Query all matching elements as a real Array.
     */
    function qsAll(selector, root = document) {
        try {
            return Array.from(root.querySelectorAll(selector));
        } catch {
            return [];
        }
    }

    /**
     * Truncate a string and append an ellipsis.
     *
     * @param {string} str
     * @param {number} max
     * @returns {string}
     */
    function truncate(str, max = 200) {
        if (!str) return "";
        return str.length > max ? str.slice(0, max) + "…" : str;
    }

    /**
     * Simple debounce wrapper.
     *
     * @param {Function} fn
     * @param {number} delay  Milliseconds.
     * @returns {Function}
     */
    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Log to console only when debug mode is on.
     *
     * @param  {...any} args
     */
    function debugLog(...args) {
        // Check the global CONFIG flag if available
        if (typeof CONFIG !== "undefined" && CONFIG.debug) {
            console.log("[PhishTool]", ...args);
        }
    }

    /**
     * Check if a URL looks suspicious (very basic heuristic).
     * Placeholder for a more robust check.
     *
     * @param {string} url
     * @returns {boolean}
     */
    function isSuspiciousUrl(url) {
        // TODO: Replace with a real reputation check
        const suspiciousPatterns = [
            /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // raw IP
            /@/,                                     // @ in URL
            /xn--/,                                  // punycode / IDN
        ];
        return suspiciousPatterns.some((pattern) => pattern.test(url));
    }

    return {
        qs,
        qsAll,
        truncate,
        debounce,
        debugLog,
        isSuspiciousUrl,
    };
})();
