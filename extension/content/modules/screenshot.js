/**
 * screenshot.js  —  Screenshot Analysis Module
 *
 * This module is a placeholder for future computer-vision logic.
 * Right now it simply receives a base-64 data-URL of a captured
 * page screenshot and returns metadata.
 *
 * Later you can plug in:
 *  • An external CV API call (e.g. Google Vision, a custom model).
 *  • Client-side TensorFlow.js analysis.
 *  • Pixel-based brand-logo detection.
 *
 * Exposed globally as `ScreenshotModule`.
 */

// eslint-disable-next-line no-var
var ScreenshotModule = (function () {
    "use strict";

    /**
     * Analyse a screenshot image.
     *
     * @param {string} dataUrl  Base-64 encoded PNG data URL.
     * @returns {object} Analysis result (placeholder).
     */
    function analyse(dataUrl) {
        if (!dataUrl) {
            throw new Error("ScreenshotModule.analyse: no dataUrl provided.");
        }

        // Extract basic metadata from the data-URL
        const meta = _extractMeta(dataUrl);

        // TODO: Send to a CV backend or run local inference
        return {
            meta,
            brandDetected: null,
            isSuspicious: null,
            _note: "CV analysis not yet implemented — placeholder.",
        };
    }

    /**
     * Convert data-URL to a Blob for potential upload.
     *
     * @param {string} dataUrl
     * @returns {Blob}
     */
    function dataUrlToBlob(dataUrl) {
        const [header, base64] = dataUrl.split(",");
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: mime });
    }

    // ── Internal ──

    function _extractMeta(dataUrl) {
        const sizeEstimate = Math.round((dataUrl.length * 3) / 4); // rough bytes
        return {
            format: "png",
            approximateSizeBytes: sizeEstimate,
            capturedAt: new Date().toISOString(),
        };
    }

    return {
        analyse,
        dataUrlToBlob,
    };
})();
