"""
routes.py — Flask route definitions.

Each route is registered on a Blueprint so the app stays modular.
"""

from flask import Blueprint, request, jsonify
from .model import predict

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


@api.route("/health", methods=["GET"])
def health_check():
    """Simple liveness probe."""
    return jsonify({"status": "ok"}), 200
