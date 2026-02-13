"""
url_model.py — URL classification model loader and prediction logic.

Loads the improved_model.pkl (XGBoost-based CalibratedClassifierCV)
and exposes a `predict_url(url)` function for URL classification.

Classes:
    0 — Benign (Legitimate / safe)
    1 — Defacement (Hacked / modified)
    2 — Phishing (Credential harvesting)
    3 — Malware (Malicious code / download)
"""

import os
import re
import joblib
import pandas as pd
from urllib.parse import urlparse

# ── Constants ────────────────────────────────────────────────────
MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "url_classification_model", "improved_model.pkl"
)

LABELS = {
    0: "benign",
    1: "defacement",
    2: "phishing",
    3: "malware",
}

# ── Load model (runs once at import time) ────────────────────────
_model = joblib.load(MODEL_PATH)
print(f"[url_model] Loaded URL model from {MODEL_PATH}")


# ── Feature extraction ───────────────────────────────────────────

def extract_url_features(url: str) -> list:
    """Extract features from URL for phishing detection model."""

    # Basic character counts
    features = {
        "url_len": len(url),
        "@": url.count("@"),
        "?": url.count("?"),
        "-": url.count("-"),
        "=": url.count("="),
        ".": url.count("."),
        "#": url.count("#"),
        "%": url.count("%"),
        "+": url.count("+"),
        "$": url.count("$"),
        "!": url.count("!"),
        "*": url.count("*"),
        ",": url.count(","),
        "//": url.count("//"),
        "digits": sum(c.isdigit() for c in url),
        "letters": sum(c.isalpha() for c in url),
    }

    # Parse URL
    parsed = urlparse(url)
    domain = parsed.netloc
    path = parsed.path

    # Abnormal URL (missing protocol or domain)
    features["abnormal_url"] = 1 if not parsed.scheme or not domain else 0

    # HTTPS
    features["https"] = 1 if parsed.scheme == "https" else 0

    # Shortening services
    shorteners = [
        "bit.ly", "tinyurl", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly"
    ]
    features["Shortining_Service"] = (
        1 if any(s in domain for s in shorteners) else 0
    )

    # IP address
    ip_pattern = r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    features["having_ip_address"] = 1 if re.search(ip_pattern, domain) else 0

    # Web-based features (defaults — require actual web scraping)
    features.update(
        {
            "web_ext_ratio": 0,
            "web_unique_domains": 0,
            "web_favicon": 0,
            "web_csp": 0,
            "web_xframe": 0,
            "web_hsts": 0,
            "web_xcontent": 0,
            "web_security_score": 0,
            "web_forms_count": 0,
            "web_password_fields": 0,
            "web_hidden_inputs": 0,
            "web_has_login": 0,
            "web_ssl_valid": 0,
        }
    )

    # Phishing indicators
    urgency_words = [
        "urgent", "verify", "update", "confirm", "suspended", "expire"
    ]
    security_words = [
        "secure", "account", "login", "signin", "bank", "payment"
    ]
    brands = [
        "paypal", "amazon", "apple", "microsoft", "google", "facebook", "netflix"
    ]

    url_lower = url.lower()
    features["phish_urgency_words"] = sum(w in url_lower for w in urgency_words)
    features["phish_security_words"] = sum(
        w in url_lower for w in security_words
    )
    features["phish_brand_mentions"] = sum(b in url_lower for b in brands)

    # Brand hijacking
    brand_in_url = any(b in url_lower for b in brands)
    brand_is_domain = any(domain.lower().startswith(b) for b in brands)
    features["phish_brand_hijack"] = (
        1 if brand_in_url and not brand_is_domain else 0
    )

    # Path length
    features["phish_long_path"] = 1 if len(path) > 75 else 0

    # Advanced phishing features
    features["phish_adv_exact_brand_match"] = (
        1 if any(b == domain.lower() for b in brands) else 0
    )
    features["phish_adv_brand_in_subdomain"] = (
        1 if any(b in domain.lower().split(".")[0] for b in brands) else 0
    )
    features["phish_adv_brand_in_path"] = (
        1 if any(b in path.lower() for b in brands) else 0
    )
    features["phish_adv_hyphen_count"] = domain.count("-")
    features["phish_adv_number_count"] = sum(c.isdigit() for c in domain)

    suspicious_tlds = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top"]
    features["phish_adv_suspicious_tld"] = (
        1 if any(domain.endswith(tld) for tld in suspicious_tlds) else 0
    )

    features["phish_adv_long_domain"] = 1 if len(domain) > 30 else 0
    features["phish_adv_many_subdomains"] = 1 if domain.count(".") > 3 else 0
    features["phish_adv_encoded_chars"] = url.count("%")

    path_keywords = [
        "login", "signin", "verify", "account", "update", "secure"
    ]
    features["phish_adv_path_keywords"] = sum(
        kw in path.lower() for kw in path_keywords
    )
    features["phish_adv_has_redirect"] = 1 if "//" in path else 0
    features["phish_adv_many_params"] = (
        1 if parsed.query.count("&") > 3 else 0
    )

    # Additional features
    hacked_terms = [
        "hacked", "leaked", "cracked", "wp-admin", "wp-content"
    ]
    features["path_has_hacked_terms"] = (
        1 if any(t in path.lower() for t in hacked_terms) else 0
    )

    suspicious_ext = [".exe", ".zip", ".apk", ".dmg"]
    features["suspicious_extension"] = (
        1 if any(path.endswith(ext) for ext in suspicious_ext) else 0
    )

    features["path_underscore_count"] = path.count("_")
    features["is_gov_edu"] = (
        1 if domain.endswith(".gov") or domain.endswith(".edu") else 0
    )

    # Return as list in the column order the model expects (49 features)
    column_order = [
        "url_len", "@", "?", "-", ".", "#", "+", "$", "!", "*",
        ",", "digits", "abnormal_url", "https",
        "Shortining_Service", "having_ip_address", "web_ext_ratio",
        "web_unique_domains", "web_favicon", "web_csp", "web_xframe",
        "web_hsts", "web_xcontent", "web_security_score", "web_forms_count",
        "web_password_fields", "web_hidden_inputs", "web_has_login",
        "web_ssl_valid", "phish_urgency_words", "phish_security_words",
        "phish_brand_hijack", "phish_long_path",
        "phish_adv_exact_brand_match", "phish_adv_brand_in_subdomain",
        "phish_adv_brand_in_path", "phish_adv_hyphen_count",
        "phish_adv_number_count", "phish_adv_suspicious_tld",
        "phish_adv_long_domain", "phish_adv_many_subdomains",
        "phish_adv_encoded_chars", "phish_adv_path_keywords",
        "phish_adv_has_redirect", "phish_adv_many_params",
        "path_has_hacked_terms", "suspicious_extension",
        "path_underscore_count", "is_gov_edu",
    ]

    return [features[col] for col in column_order]


# ── Prediction ───────────────────────────────────────────────────

def predict_url(url: str) -> dict:
    """
    Classify a URL as legitimate, phishing, defacement, or malware.

    Args:
        url: The full URL string.

    Returns:
        dict with keys:
            label       (int)   — 0, 1, 2, or 3
            label_name  (str)   — human-readable class name
            confidence  (float) — probability of predicted class
            probabilities (dict) — per-class probabilities
    """
    feature_values = extract_url_features(url)

    # The model's ColumnTransformer expects a DataFrame with named columns
    column_order = [
        "url_len", "@", "?", "-", ".", "#", "+", "$", "!", "*",
        ",", "digits", "abnormal_url", "https",
        "Shortining_Service", "having_ip_address", "web_ext_ratio",
        "web_unique_domains", "web_favicon", "web_csp", "web_xframe",
        "web_hsts", "web_xcontent", "web_security_score", "web_forms_count",
        "web_password_fields", "web_hidden_inputs", "web_has_login",
        "web_ssl_valid", "phish_urgency_words", "phish_security_words",
        "phish_brand_hijack", "phish_long_path",
        "phish_adv_exact_brand_match", "phish_adv_brand_in_subdomain",
        "phish_adv_brand_in_path", "phish_adv_hyphen_count",
        "phish_adv_number_count", "phish_adv_suspicious_tld",
        "phish_adv_long_domain", "phish_adv_many_subdomains",
        "phish_adv_encoded_chars", "phish_adv_path_keywords",
        "phish_adv_has_redirect", "phish_adv_many_params",
        "path_has_hacked_terms", "suspicious_extension",
        "path_underscore_count", "is_gov_edu",
    ]
    df = pd.DataFrame([feature_values], columns=column_order)
    probs = _model.predict_proba(df)[0]
    pred_label = int(probs.argmax())
    confidence = float(probs[pred_label])

    return {
        "label": pred_label,
        "label_name": LABELS[pred_label],
        "confidence": round(confidence, 4),
        "probabilities": {
            name: round(float(probs[idx]), 4) for idx, name in LABELS.items()
        },
    }
