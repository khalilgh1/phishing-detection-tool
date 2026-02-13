/**
 * overlay-ui.js  —  Floating Overlay Component
 *
 * Creates a floating, draggable overlay on the page that displays
 * either a text message (Gmail info) or a screenshot image preview.
 *
 * Exposed globally as `OverlayUI`.
 */

// eslint-disable-next-line no-var
var OverlayUI = (function () {
    "use strict";

    const OVERLAY_ID = "phishing-tool-overlay";

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────

    /**
     * Show a text-based info overlay (used for Gmail results).
     *
     * @param {string} text  The message to display (supports newlines).
     * @param {object} [options]
     * @param {number} [options.top=20]
     * @param {number} [options.right=20]
     */
    function showMessage(text, options = {}) {
        remove();
        const { top = 20, right = 20 } = options;

        const overlay = _createShell(top, right);

        // Message body
        const body = document.createElement("div");
        body.className = "phishing-tool-overlay__body";
        body.textContent = text;
        overlay.appendChild(body);

        document.body.appendChild(overlay);
        _makeDraggable(overlay, overlay.querySelector(".phishing-tool-overlay__header"));
    }

    /**
     * Show a screenshot overlay with the actual captured image
     * and a success label.  (Used for non-Gmail pages.)
     *
     * @param {string} dataUrl  Base-64 PNG data URL of the screenshot.
     * @param {object} [options]
     * @param {number} [options.top=20]
     * @param {number} [options.right=20]
     * @param {number} [options.width=360]  Image display width.
     */
    function showScreenshot(dataUrl, options = {}) {
        remove();
        const { top = 20, right = 20, width = 360 } = options;

        const overlay = _createShell(top, right);
        overlay.style.width = `${width}px`;

        // Success label
        const label = document.createElement("div");
        label.className = "phishing-tool-overlay__body";
        label.textContent = "Screenshot saved successfully";
        overlay.appendChild(label);

        // Screenshot image
        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "Page screenshot";
        img.className = "phishing-tool-overlay__image";
        overlay.appendChild(img);

        document.body.appendChild(overlay);
        _makeDraggable(overlay, overlay.querySelector(".phishing-tool-overlay__header"));
    }

    /**
     * Remove the overlay from the page, if present.
     */
    function remove() {
        const existing = document.getElementById(OVERLAY_ID);
        if (existing) existing.remove();
    }

    /**
     * Update the text inside an existing overlay body.
     */
    function updateMessage(text) {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;
        const body = overlay.querySelector(".phishing-tool-overlay__body");
        if (body) body.textContent = text;
    }

    // ──────────────────────────────────────────────
    // Internal: build the shared overlay shell (header + close button)
    // ──────────────────────────────────────────────

    function _createShell(top, right) {
        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.className = "phishing-tool-overlay";
        overlay.style.top = `${top}px`;
        overlay.style.right = `${right}px`;

        const header = document.createElement("div");
        header.className = "phishing-tool-overlay__header";

        const title = document.createElement("span");
        title.textContent = "Phishing Detection Tool";
        header.appendChild(title);

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "\u2715";
        closeBtn.className = "phishing-tool-overlay__close";
        closeBtn.addEventListener("click", remove);
        header.appendChild(closeBtn);

        overlay.appendChild(header);
        return overlay;
    }

    // ──────────────────────────────────────────────
    // Dragging Logic
    // ──────────────────────────────────────────────

    function _makeDraggable(element, handle) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handle.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            element.style.left = `${element.getBoundingClientRect().left}px`;
            element.style.right = "auto";
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            element.style.left = `${e.clientX - offsetX}px`;
            element.style.top = `${e.clientY - offsetY}px`;
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
        });
    }

    // ──────────────────────────────────────────────
    return {
        showMessage,
        showScreenshot,
        remove,
        updateMessage,
    };
})();
