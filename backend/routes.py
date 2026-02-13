"""
routes.py — Flask route definitions.

Each route is registered on a Blueprint so the app stays modular.
"""

from flask import Blueprint, request, jsonify
from .model import predict
from ..storing_and_hashing import find_visual_match
from urllib.parse import urlparse

api = Blueprint("api", __name__)


@api.route("/predict", methods=["POST"])
def predict_email():
    """
    Classify an email as phishing or legitimate.

    Expects JSON:
        { "text": "<email content string>" }

    Returns JSON:
        {
            "label": 0 | 1,
            "label_name": "legitimate" | "phishing",
            "confidence": 0.0–1.0,
            "probabilities": {
                "legitimate": float,
                "phishing": float
            }
        }
    """
    body = request.get_json(silent=True)

    if not body or "text" not in body:
        return jsonify({"error": "Missing 'text' field in JSON body."}), 400

    text = body["text"].strip()
    if not text:
        return jsonify({"error": "'text' field cannot be empty."}), 400

    result = predict(text)
    return jsonify(result), 200


@api.route("/predict_visual", methods=["POST"])
def predict_visual():
    """
    Analyze a screenshot for visual similarity to known legitimate sites.

    Expects JSON:
        {
            "screenshot": "<base64-encoded image string>",
            "url": "<current page URL>"
        }

    Returns JSON:
        {
            "is_phishing": True | False,
            "reason": "...",
            "details": { ... }
        }
    """
    body = request.get_json(silent=True)

    if not body or "screenshot" not in body or "url" not in body:
        return jsonify({"error": "Missing 'screenshot' or 'url' in JSON body."}), 400

    screenshot_base64 = body["screenshot"]
    current_url = body["url"]

    if not all([screenshot_base64, current_url]):
        return jsonify({"error": "Fields cannot be empty."}), 400

    visual_result = find_visual_match(screenshot_base64)

    if not visual_result or not visual_result.get("match_found"):
        return jsonify({
            "is_phishing": False,
            "reason": "No visual match found in the database.",
            "details": visual_result
        }), 200

    if visual_result.get("is_visual_match"):
        # Visual match found, now check the domain
        try:
            closest_match_domain = urlparse(f"http://{visual_result['closest_match']}").hostname.replace("www.", "")
            current_domain = urlparse(current_url).hostname.replace("www.", "")

            # Normalize by removing common prefixes/suffixes if needed
            # Example: login.google.com vs. accounts.google.com
            # This is a simple check; more robust logic may be needed
            if closest_match_domain.split('.')[-2] != current_domain.split('.')[-2]:
                 return jsonify({
                    "is_phishing": True,
                    "reason": f"Page looks like {visual_result['closest_match']} but is on a different domain ({current_domain}).",
                    "details": visual_result
                }), 200

        except Exception as e:
            return jsonify({"error": f"URL processing failed: {e}"}), 500

    return jsonify({
        "is_phishing": False,
        "reason": "The page does not visually match any known phishing targets.",
        "details": visual_result
    }), 200


@api.route("/health", methods=["GET"])
def health_check():
    """Simple liveness probe."""
    return jsonify({"status": "ok"}), 200
