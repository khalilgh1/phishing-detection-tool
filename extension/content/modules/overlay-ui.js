/**
 * overlay-ui.js  —  Osprey Floating Overlay Component
 *
 * Creates a floating, draggable overlay on Gmail pages that displays
 * phishing detection results with branded Osprey styling (blue & orange).
 *
 * Exposed globally as `OverlayUI`.
 */

// eslint-disable-next-line no-var
var OverlayUI = (function () {
    "use strict";

    const OVERLAY_ID = "osprey-overlay";

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────

    /**
     * Show loading state while the backend processes the email.
     */
    function showLoading(from, subject) {
        remove();
        const overlay = _createShell();

        const content = document.createElement("div");
        content.className = "osprey-overlay__content";

        // Email info
        const emailInfo = document.createElement("div");
        emailInfo.className = "osprey-overlay__email-info";
        emailInfo.innerHTML =
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">From:</span> ${_esc(from)}</div>` +
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">Subject:</span> ${_esc(subject)}</div>`;
        content.appendChild(emailInfo);

        // Spinner
        const spinner = document.createElement("div");
        spinner.className = "osprey-overlay__spinner-wrap";
        spinner.innerHTML =
            '<div class="osprey-overlay__spinner"></div>' +
            '<div class="osprey-overlay__spinner-text">Analyzing email\u2026</div>';
        content.appendChild(spinner);

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        _makeDraggable(overlay, overlay.querySelector(".osprey-overlay__header"));
    }

    /**
     * Show the phishing detection result.
     */
    function showResult(data) {
        remove();
        const { from, subject, bodyPreview, label, confidence, probabilities } = data;
        const isPhishing = label === "phishing";

        const overlay = _createShell();

        const content = document.createElement("div");
        content.className = "osprey-overlay__content";

        // ── Result Badge ──
        const badge = document.createElement("div");
        badge.className = `osprey-overlay__badge ${isPhishing ? "osprey-overlay__badge--danger" : "osprey-overlay__badge--safe"}`;
        badge.innerHTML = isPhishing
            ? '<span class="osprey-overlay__badge-icon">\u26A0</span> Phishing Detected'
            : '<span class="osprey-overlay__badge-icon">\u2713</span> Legitimate Email';
        content.appendChild(badge);

        // ── Confidence Bar ──
        const confWrap = document.createElement("div");
        confWrap.className = "osprey-overlay__confidence";
        const confPct = Math.round(confidence * 100);
        confWrap.innerHTML =
            `<div class="osprey-overlay__conf-label">Confidence: <strong>${confPct}%</strong></div>` +
            `<div class="osprey-overlay__conf-bar">` +
            `<div class="osprey-overlay__conf-fill ${isPhishing ? "osprey-overlay__conf-fill--danger" : "osprey-overlay__conf-fill--safe"}" style="width:${confPct}%"></div>` +
            `</div>`;
        content.appendChild(confWrap);

        // ── Probabilities ──
        const probDiv = document.createElement("div");
        probDiv.className = "osprey-overlay__probabilities";
        probDiv.innerHTML =
            `<div class="osprey-overlay__prob-row"><span>Legitimate:</span><span>${Math.round(probabilities.legitimate * 100)}%</span></div>` +
            `<div class="osprey-overlay__prob-row"><span>Phishing:</span><span>${Math.round(probabilities.phishing * 100)}%</span></div>`;
        content.appendChild(probDiv);

        // ── Divider ──
        content.appendChild(_createDivider());

        // ── Email Info ──
        const emailInfo = document.createElement("div");
        emailInfo.className = "osprey-overlay__email-info";
        emailInfo.innerHTML =
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">From:</span> ${_esc(from)}</div>` +
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">Subject:</span> ${_esc(subject)}</div>` +
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">Preview:</span> ${_esc(bodyPreview)}</div>`;
        content.appendChild(emailInfo);

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        _makeDraggable(overlay, overlay.querySelector(".osprey-overlay__header"));
    }

    /**
     * Show an error state when the backend is unreachable or fails.
     */
    function showError(from, subject, errorMsg) {
        remove();
        const overlay = _createShell();

        const content = document.createElement("div");
        content.className = "osprey-overlay__content";

        // Error badge
        const badge = document.createElement("div");
        badge.className = "osprey-overlay__badge osprey-overlay__badge--error";
        badge.innerHTML = '<span class="osprey-overlay__badge-icon">\u2715</span> Analysis Failed';
        content.appendChild(badge);

        // Error message
        const msg = document.createElement("div");
        msg.className = "osprey-overlay__error-msg";
        msg.textContent = errorMsg || "Could not connect to the Osprey backend. Make sure the server is running.";
        content.appendChild(msg);

        // Email info
        const emailInfo = document.createElement("div");
        emailInfo.className = "osprey-overlay__email-info";
        emailInfo.innerHTML =
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">From:</span> ${_esc(from)}</div>` +
            `<div class="osprey-overlay__field"><span class="osprey-overlay__label">Subject:</span> ${_esc(subject)}</div>`;
        content.appendChild(emailInfo);

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        _makeDraggable(overlay, overlay.querySelector(".osprey-overlay__header"));
    }

    /**
     * Remove the overlay from the page, if present.
     */
    function remove() {
        const existing = document.getElementById(OVERLAY_ID);
        if (existing) existing.remove();
    }

    // ──────────────────────────────────────────────
    // Internal Helpers
    // ──────────────────────────────────────────────

    function _createShell() {
        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.className = "osprey-overlay";

        const header = document.createElement("div");
        header.className = "osprey-overlay__header";

        // Title with logo
        const titleWrap = document.createElement("div");
        titleWrap.className = "osprey-overlay__title-wrap";

        const logo = document.createElement("img");
        logo.src = chrome.runtime.getURL("icons/osprey.png");
        logo.className = "osprey-overlay__logo";
        logo.alt = "Osprey";
        titleWrap.appendChild(logo);

        const title = document.createElement("span");
        title.className = "osprey-overlay__title";
        title.textContent = "Osprey";
        titleWrap.appendChild(title);

        header.appendChild(titleWrap);

        // Close button
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "\u2715";
        closeBtn.className = "osprey-overlay__close";
        closeBtn.addEventListener("click", remove);
        header.appendChild(closeBtn);

        overlay.appendChild(header);
        return overlay;
    }

    function _createDivider() {
        const hr = document.createElement("div");
        hr.className = "osprey-overlay__divider";
        return hr;
    }

    /**
     * Escape HTML entities to prevent XSS in innerHTML.
     */
    function _esc(str) {
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

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
        showLoading,
        showResult,
        showError,
        remove,
    };
})();
