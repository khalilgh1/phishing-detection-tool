"""
model.py — DistilBERT model loader and prediction logic.

Loads the fine-tuned distilbert-base-uncased model once at import time
and exposes a `predict(text)` function for single-email classification.
"""

import os
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

# ── Constants ────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "distilbert_model", "distilbert-phishing-model")
MAX_LENGTH = 512
LABELS = {0: "legitimate", 1: "phishing"}

# ── Device ───────────────────────────────────────────────────────
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Load model & tokenizer (runs once when the module is imported) ──
_tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_DIR)
_model = DistilBertForSequenceClassification.from_pretrained(MODEL_DIR)
_model.to(_device)
_model.eval()

print(f"[model] Loaded DistilBERT from {MODEL_DIR}  (device={_device})")


def predict(text: str) -> dict:
    """
    Classify a single email text as phishing or legitimate.

    Args:
        text: The email content string (sender + subject + body concatenated).

    Returns:
        dict with keys:
            label       (int)   — 0 or 1
            label_name  (str)   — "legitimate" or "phishing"
            confidence  (float) — probability of the predicted class
            probabilities (dict) — {"legitimate": float, "phishing": float}
    """
    inputs = _tokenizer(
        text,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=MAX_LENGTH,
    ).to(_device)

    with torch.no_grad():
        logits = _model(**inputs).logits
        probs = torch.softmax(logits, dim=-1).squeeze()

    pred_label = int(torch.argmax(probs).item())
    confidence = float(probs[pred_label].item())

    return {
        "label": pred_label,
        "label_name": LABELS[pred_label],
        "confidence": round(confidence, 4),
        "probabilities": {
            "legitimate": round(float(probs[0].item()), 4),
            "phishing": round(float(probs[1].item()), 4),
        },
    }
