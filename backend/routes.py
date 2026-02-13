"""
routes.py — Flask route definitions.

Each route is registered on a Blueprint so the app stays modular.
"""

from flask import Blueprint, request, jsonify
import check_url_legitimacy
from .model import predict
from ..storing_and_hashing import find_visual_match
from .url_model import predict_url

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


@api.route("/predict-url", methods=["POST"])
def predict_url_route():
    """
    Classify a URL as legitimate, phishing, defacement, or malware.

    Expects JSON:
        { "url": "<full URL string>" }

    Returns JSON:
        {
            "label": 0 | 1 | 2 | 3,
            "label_name": "legitimate" | "phishing" | "defacement" | "malware",
            "confidence": 0.0–1.0,
            "probabilities": {
                "legitimate": float,
                "phishing": float,
                "defacement": float,
                "malware": float
            }
        }
    """
    body = request.get_json(silent=True)

    if not body or "url" not in body:
        return jsonify({"error": "Missing 'url' field in JSON body."}), 400

    url = body["url"].strip()
    if not url:
        return jsonify({"error": "'url' field cannot be empty."}), 400

    result = predict_url(url)
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
        # Visual match found, proceed to URL checking
        try:
            if check_url_legitimacy.check_url_legitimacy(visual_result['closest_match'], body['url'])['status'] == "PHISHING":
                return jsonify({
                    "is_phishing": True,
                    "reason": f"Page looks like {visual_result['closest_match']} but is on a different domain ({body['url']}).",
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
