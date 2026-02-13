# PhishGuard AI -- Multi-Layer Phishing Detection System

A multi-layered phishing detection system that combines URL-based machine learning, email content analysis via DistilBERT, and visual similarity detection through perceptual hashing. Built as a Chrome extension with a Flask backend, the system analyzes web pages, emails, and screenshots in real time to identify phishing attempts across multiple attack vectors.

---

## Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Detection Layers](#detection-layers)
  - [Layer 1: URL-Based ML Analysis](#layer-1-url-based-ml-analysis)
  - [Layer 2: Email Content Analysis (DistilBERT)](#layer-2-email-content-analysis-distilbert)
  - [Layer 3: Visual Similarity Detection](#layer-3-visual-similarity-detection)
- [URL Model Pipeline: Step-by-Step Process](#url-model-pipeline-step-by-step-process)
  - [Step 1: Data Cleaning and Preparation](#step-1-data-cleaning-and-preparation)
  - [Step 2: Baseline Model Training](#step-2-baseline-model-training)
  - [Step 3: Phishing-Focused Improvement](#step-3-phishing-focused-improvement)
  - [Step 4: Balanced Optimization](#step-4-balanced-optimization)
  - [Step 5: Security Audit](#step-5-security-audit)
  - [Step 6: Threshold Optimization](#step-6-threshold-optimization)
  - [Step 7: Trusted Hybrid Engine](#step-7-trusted-hybrid-engine)
- [Key Technical Decisions](#key-technical-decisions)
- [Performance Summary](#performance-summary)
- [Repository Structure](#repository-structure)
- [Setup Instructions](#setup-instructions)
- [API Reference](#api-reference)
- [Chrome Extension Usage](#chrome-extension-usage)
- [Known Limitations and Future Work](#known-limitations-and-future-work)

---

## Project Overview

Phishing attacks remain one of the most prevalent cybersecurity threats. Traditional detection methods rely on blacklists or single-signal analysis, both of which are easily bypassed by attackers. PhishGuard AI addresses this by combining three independent detection layers into a unified system:

1. **URL feature analysis** using a gradient-boosted tree model (XGBoost) trained on 650,000+ labeled URLs with 54 engineered features covering URL structure, web security headers, SSL certificates, and semantic phishing indicators.

2. **Email content classification** using a fine-tuned DistilBERT transformer model that analyzes email sender, subject, and body text to distinguish phishing emails from legitimate correspondence.

3. **Visual similarity detection** using perceptual hashing (pHash) to compare page screenshots against a database of known legitimate login pages, catching phishing pages that visually clone trusted sites but serve them from different domains.

The system is delivered as a Chrome extension (Manifest V3) named Osprey, which integrates with Gmail to scan emails automatically and provides on-demand page analysis through the browser toolbar.

---

## System Architecture

```
                          +-------------------+
                          |  Chrome Extension  |
                          |     (Osprey)       |
                          +--------+----------+
                                   |
                    +--------------+--------------+
                    |              |               |
              +-----v----+  +-----v------+  +-----v------+
              |  Gmail    |  | Screenshot |  |   Popup    |
              |  Module   |  |  Module    |  |    UI      |
              +-----+----+  +-----+------+  +-----+------+
                    |              |               |
                    +--------------+--------------+
                                   |
                          +--------v----------+
                          |  Service Worker    |
                          |  (Background)      |
                          +--------+----------+
                                   |
                          +--------v----------+
                          |   Flask Backend    |
                          |   (app.py)         |
                          +--------+----------+
                                   |
                    +--------------+--------------+
                    |              |               |
              +-----v----+  +-----v------+  +-----v------+
              | DistilBERT|  |  Visual    |  |  URL Model |
              |  Email    |  |  Matching  |  |  (XGBoost) |
              |  Model    |  |  (pHash)   |  |  Pipeline  |
              +-----------+  +------------+  +------------+
```

- The **Chrome extension** runs content scripts on Gmail pages, captures screenshots, and sends data to the Flask backend.
- The **Flask backend** exposes REST endpoints for email prediction (`/api/predict`) and visual matching (`/api/predict_visual`).
- The **URL model** operates as a standalone pipeline for batch analysis and can be integrated into the backend for real-time URL scoring.

---

## Detection Layers

### Layer 1: URL-Based ML Analysis

Analyzes 54 features extracted from a URL and its associated web page to classify it as Benign, Defacement, Phishing, or Malware.

**Feature categories (54 total):**

| Category | Count | Examples |
|----------|-------|---------|
| Static URL features | 37 | URL length, special character counts (`@`, `?`, `-`, `=`, `.`), digit/letter ratio, IP address presence, URL shortener usage, suspicious TLD, encoded characters, path keywords |
| Web sandbox features | 13 | HTTPS status, SSL validity, security headers (CSP, HSTS, X-Frame-Options, X-Content-Type), favicon presence, form count, password fields, hidden inputs, login page detection |
| NLP semantic features | 4 | Urgency word count, security-related word count, brand mention detection, brand hijack detection |

**Model:** XGBoost gradient-boosted trees, trained on 650,682 labeled samples across 4 classes.

**Production engine:** Trusted Hybrid Decision Engine -- wraps the ML model with a trust-scoring layer that reduces false positives on legitimate domains with strong security signals (HTTPS, valid SSL, security headers, government/education TLDs).

### Layer 2: Email Content Analysis (DistilBERT)

A fine-tuned `distilbert-base-uncased` transformer model that classifies email text as legitimate or phishing. The model processes concatenated sender, subject, and body text with a maximum sequence length of 512 tokens.

**Training notebook:** `phishing_distilbert.ipynb`
**Data preparation:** `prepare_emails.ipynb`
**Inference:** `backend/model.py`

### Layer 3: Visual Similarity Detection

Uses perceptual hashing (pHash) to detect pages that visually impersonate known legitimate sites. The system maintains a database of screenshot hashes from top-ranked domains (sourced from the Tranco list). When a user visits a page, its screenshot is compared against the database. If a visual match is found but the domain differs from the matched site, the page is flagged as a potential phishing clone.

**Hash algorithm:** pHash via the `imagehash` library
**Match threshold:** Hamming distance <= 5
**Screenshot capture:** Automated via Playwright (headless Firefox), targeting pages with password input fields
**Implementation:** `storing_and_hashing.py`

---

## URL Model Pipeline: Step-by-Step Process

The URL-based detection model was developed through an iterative pipeline of seven stages. Each stage produced measurable improvements and addressed specific weaknesses identified in the previous stage. No raw datasets are included in this repository; the pipeline scripts document the full process.

### Step 1: Data Cleaning and Preparation

**Script:** `url_model/pipelines/phishguard_cleaning_pipeline.py`

Starting from a raw dataset of 650,682 labeled URLs with 67 columns, the cleaning pipeline performed the following operations:

1. **Removed 6 leakage columns** that would not be available at inference time: `scan_date`, `scan_year`, `scan_month`, `scan_day`, `web_http_status`, `web_is_live`. These columns encode information about when a URL was scanned or whether it was accessible at scan time, which provides no predictive value for new URLs.

2. **Removed 3 identifier columns** to prevent the model from memorizing specific URLs: `url`, `domain`, `type`. Keeping raw URL strings would allow the model to overfit to training examples rather than learning generalizable patterns.

3. **Resolved 3 duplicate feature pairs** where two columns encoded the same signal. In each case, the more advanced variant (`phish_adv_*` prefix) was kept: `phish_adv_suspicious_tld` over `phish_suspicious_tld`, `phish_adv_many_params` over `phish_many_params`, `phish_adv_many_subdomains` over `phish_multiple_subdomains`.

4. **Classified the remaining 54 features** into three runtime groups: 37 static URL features (extractable from the URL string alone), 13 web sandbox features (requiring a headless browser visit), and 4 NLP semantic features (requiring text analysis of page content).

5. **Validated data quality:** confirmed zero missing values, identified 5 highly correlated feature pairs (r > 0.95), verified 23 binary columns, and documented class distribution: Benign 65.7%, Defacement 14.8%, Phishing 14.4%, Malware 5.0%.

**Output:** `ml_training_ready_dataset.csv` (54 features + label), `feature_groups.json`, `removed_columns_report.md`, `data_quality_report.md`

### Step 2: Baseline Model Training

**Script:** `url_model/pipelines/phishguard_training_pipeline.py`

Trained and compared three classifiers on an 80/20 stratified train/test split:

| Model | Accuracy | ROC-AUC |
|-------|----------|---------|
| Logistic Regression | 0.846 | 0.950 |
| Random Forest | 0.889 | 0.960 |
| XGBoost | 0.904 | 0.968 |

XGBoost was selected as the best model. Its predictions were calibrated using Platt scaling (sigmoid method) to produce well-calibrated probability estimates.

**Critical finding:** While overall accuracy reached 90.4%, per-class analysis revealed that Phishing recall was only 41.7% -- the model missed more than half of all phishing URLs. This is unacceptable for a security tool where false negatives (missed phishing) carry asymmetric risk.

**Output:** `heuristic_model.pkl`, `preprocessing_pipeline.pkl`, `model_metadata.json`, `model_metrics.json`

### Step 3: Phishing-Focused Improvement

**Script:** `url_model/pipelines/phishguard_improved_pipeline.py`

Addressed the critical phishing recall gap through aggressive optimization:

1. **Removed 5 redundant correlated features** to reduce noise: `letters`, `//`, `phish_brand_mentions`, `%`, `=`.
2. **Applied 2x class weighting** for the Phishing class during XGBoost training.
3. **Used SMOTE oversampling** to generate synthetic Phishing samples (target: 50% of Benign class size) and Malware samples (target: 30% of Benign).
4. **Tuned hyperparameters:** increased tree count, lowered learning rate, added L1/L2 regularization.
5. **Optimized per-class thresholds** to ensure Phishing recall exceeded 70%.

**Result:** Phishing recall improved from 41.7% to 88.7%, but overall accuracy dropped from 90.4% to 74.8%. The precision-recall trade-off shifted: more phishing was caught, but more legitimate URLs were incorrectly flagged.

**Output:** `improved_model.pkl`, `improved_model_metrics.json`, `optimal_thresholds.json`

### Step 4: Balanced Optimization

**Script:** `url_model/pipelines/phishguard_balanced_pipeline.py`

Explored four strategies to find a middle ground between baseline accuracy and improved recall:

- **v3a:** Moderate class weights (1.5x Phishing boost)
- **v3b:** Gentle SMOTE (25% of Benign) + moderate weights (1.3x)
- **v3c:** Soft voting ensemble averaging v3a and v3b probabilities
- **v3d:** Threshold tuning on v3a to find the minimum threshold achieving 60% Phishing recall with 82% accuracy

Best result was v3b (SMOTE + Weighted): Accuracy 78.3%, Phishing recall 84.7%, Phishing F1 0.538.

**Conclusion:** No single threshold or training strategy could simultaneously satisfy all three constraints (recall >= 85%, precision >= 70%, FPR <= 15%). This fundamental trade-off motivated the decision to adopt a security-focused threshold with a separate false-positive mitigation layer.

**Output:** `balanced_improved_model.pkl`, `balanced_improvement_report.json`

### Step 5: Security Audit

**Script:** `url_model/pipelines/phishguard_security_audit.py`

Before deployment, the model underwent eight audit checks:

1. **Data leakage detection:** Mutual information analysis found `abnormal_url` as a potential label proxy (MI = 0.33). While flagged as a risk, the feature was retained because it encodes genuine URL structure anomalies.

2. **Feature dominance:** Ablation testing (removing top-5 features individually and cumulatively) showed stable performance -- maximum ROC-AUC drop was only 0.018, indicating no single feature dominates predictions.

3. **Overfitting analysis:** Train/test accuracy gap was 0.23%, and 5-fold cross-validation yielded 0.883 +/- 0.001, confirming the model generalizes well.

4. **Feature correlation:** 10 feature pairs with |r| > 0.85 and 10 features with VIF > 10 were identified. While present, they do not significantly harm XGBoost performance.

5. **False negative analysis:** Confirmed Phishing (class 2) as the weakest class with 43.3% recall in the baseline model.

6. **Calibration verification:** Average Brier score of 0.034 and ECE of 0.008 confirmed well-calibrated probabilities after Platt scaling.

7. **Architecture boundary check:** Identified 4 NLP features (`phish_brand_hijack`, `phish_brand_mentions`, `phish_security_words`, `phish_urgency_words`) that semantically belong in the NLP engine rather than the heuristic engine.

8. **Adversarial robustness:** Noise injection testing showed a 49.4% prediction flip rate, indicating sensitivity to input perturbation. Synthetic phishing test cases were flagged at 100%.

**Final deployment readiness score: 60/100.** Sufficient for demonstration purposes; not production-grade.

**Output:** `security_audit_report.md`, `deployment_readiness.json`, `leakage_analysis.csv`, `feature_ablation_results.csv`, `calibration_verification.png`, `correlation_heatmap.png`

### Step 6: Threshold Optimization

**Script:** `url_model/pipelines/phishguard_security_optimization.py`

Swept 91 threshold values (0.05 to 0.95 in 0.01 increments) on the improved model to find the optimal operating point. Three deployment profiles were defined:

| Profile | Threshold | Phishing Recall | Precision | FPR | Alerts/1000 Legit |
|---------|-----------|-----------------|-----------|-----|-------------------|
| Security-Focused | 0.11 | 85.24% | 40.35% | 21.28% | 212.8 |
| Balanced | 0.21 | 68.59% | 49.04% | 12.04% | 120.4 |
| Precision-Focused | 0.47 | 40.72% | 70.54% | 2.87% | 28.7 |

The **Security-Focused profile** (threshold 0.11) was selected for production use because missing a phishing URL carries higher risk than generating a false alert. The system assigns risk tiers:

- **ALLOW** (score < 0.11): No action required
- **MONITOR** (0.11 - 0.40): Low risk, log for review
- **WARN** (0.40 - 0.70): Medium risk, alert the user
- **BLOCK** (>= 0.70): High risk, block access

**Output:** `deployment_threshold.json`, `security_impact_report.json`, `threshold_analysis.csv`, plus 5 visualization charts

### Step 7: Trusted Hybrid Engine

**Script:** `url_model/models/hybrid_engine_simple.py`

The final production engine addresses the high false positive rate (21.3%) from the security-focused threshold by adding a trust-scoring layer on top of the ML predictions:

1. **Trust score computation (0 to 1):** Each URL receives a trust score based on positive security signals: HTTPS (+0.15), valid SSL (+0.15), government/education domain (+0.20), security headers (CSP/HSTS, up to +0.10), favicon presence (+0.05), normal URL structure (+0.10), and absence of phishing indicators (+0.05 each for no IP address, no shortener, no brand hijack, no suspicious TLD).

2. **Safety-gated override:** Before reducing any ML score, the engine verifies the absence of all phishing signals (IP address, URL shortener, brand hijacking, brand in subdomain, suspicious TLD, encoded characters) and confirms reasonable security header presence. Only URLs that pass all safety checks are eligible for score reduction.

3. **Tiered score reduction:** Very strong trusted domains (government/education + HTTPS + SSL + all safety checks) receive a 95% score reduction. Strong trusted domains (high trust + HTTPS + SSL) receive 80% reduction. Basic trusted domains receive 65% reduction. Untrusted or suspicious domains are never modified.

**Result on the full dataset:**
- 48 false positives on trusted domains were corrected (14.3% reduction in trusted-domain FPs)
- Phishing recall decreased by 0.93% (from 85.24% to 84.31%)
- 921 total overrides applied; 873 involved actual phishing samples that happened to have some security signals, which were accepted as an explicit trade-off

The engine is serialized as `trusted_hybrid_model.pkl` and can be loaded directly for inference.

---

## Key Technical Decisions

**Why XGBoost over deep learning for URL analysis?**
The 54-feature tabular dataset is well-suited to gradient-boosted trees. XGBoost consistently outperforms neural networks on structured tabular data (see Grinsztajn et al., 2022), trains in seconds rather than hours, requires no GPU, and produces interpretable feature importances. DistilBERT was reserved for email text where sequential token relationships matter.

**Why threshold 0.11 instead of the default 0.50?**
A standard 0.50 threshold achieves only 40.7% phishing recall -- it misses 6 out of 10 phishing URLs. Because the cost of a missed phishing URL (credential theft, data breach) far exceeds the cost of a false alert (user clicks "dismiss"), the operating point was deliberately shifted toward recall. The resulting 21.3% false positive rate is mitigated by the trusted domain protection layer.

**Why not simply remove false positives by raising precision?**
Precision and recall are inversely coupled at any given threshold. Raising the threshold to 0.47 achieves 70.5% precision but drops recall to 40.7%. Instead, the trusted hybrid approach addresses false positives surgically: it only overrides ML predictions for URLs that demonstrably satisfy multiple independent security criteria, preserving recall for untrusted or suspicious domains.

**Why remove raw datasets from the repository?**
The raw dataset (`cleaned_dataset.csv`, 157 MB) and email corpus (`emails.csv`, 65 MB) are too large for version control and can be regenerated by running the pipeline scripts against the original data sources. The repository includes only the trained model artifacts (`.pkl` files via Git LFS) and the pipeline code to reproduce the full workflow.

**Why Platt scaling for calibration?**
XGBoost outputs raw margin scores that do not correspond to true probabilities. Platt scaling (logistic sigmoid fit on held-out data) converts these margins into calibrated probabilities, achieving a Brier score of 0.034 and ECE of 0.008. This is essential for threshold-based decision making: a score of 0.11 must reliably correspond to approximately 11% phishing likelihood for the threshold system to function correctly.

---

## Performance Summary

### URL Model (XGBoost + Trusted Hybrid)

| Metric | Baseline (v1) | Improved (v2) | Production (Hybrid) |
|--------|---------------|---------------|---------------------|
| Overall Accuracy | 90.43% | 74.82% | -- |
| Phishing Recall | 41.70% | 88.65% | 84.31% |
| Phishing Precision | -- | 36.00% | 40.09% |
| ROC-AUC | 0.968 | 0.952 | 0.897 |
| FPR | -- | -- | 21.27% |
| F1 (Phishing) | -- | -- | 0.543 |

### Dataset Composition

| Class | Count | Percentage |
|-------|-------|------------|
| Benign | 427,513 | 65.7% |
| Defacement | 96,457 | 14.8% |
| Phishing | 94,014 | 14.4% |
| Malware | 32,698 | 5.0% |
| **Total** | **650,682** | **100%** |

---

## Repository Structure

```
phishing-detection-tool/
|
|-- app.py                          # Flask entry point
|-- requirements.txt                # Python dependencies
|-- screenshot_from_url.py          # Automated screenshot capture (Playwright)
|-- storing_and_hashing.py          # Visual similarity engine (pHash)
|-- phishing_distilbert.ipynb       # DistilBERT email model training notebook
|-- prepare_emails.ipynb            # Email dataset preparation notebook
|
|-- backend/                        # Flask API server
|   |-- __init__.py                 # App factory
|   |-- model.py                    # DistilBERT inference
|   |-- routes.py                   # API endpoints (/predict, /predict_visual)
|   +-- distilbert_model/           # Model weights (not in repo, download separately)
|
|-- extension/                      # Chrome extension (Manifest V3)
|   |-- manifest.json
|   |-- background/
|   |   +-- service-worker.js       # Screenshot capture, API calls
|   |-- content/
|   |   |-- content.js              # Page type detection, module routing
|   |   |-- overlay.css
|   |   +-- modules/
|   |       |-- gmail.js            # Gmail email extraction
|   |       |-- overlay-ui.js       # Draggable result overlay
|   |       |-- screenshot.js       # Screenshot analysis module
|   |       +-- utils.js            # Shared helpers
|   +-- popup/
|       |-- popup.html
|       |-- popup.css
|       +-- popup.js
|
|-- datasets/                       # Visual matching reference images
|   |-- screenshots/                # pHash database (legitimate login pages)
|   +-- target_screenshots/         # Test phishing screenshots
|
|-- phishing/                       # Bruno API test collection
|
+-- url_model/                      # URL-based ML detection pipeline
    |
    |-- pipelines/                  # Training and analysis scripts (run in order)
    |   |-- phishguard_cleaning_pipeline.py      # Step 1: Data cleaning
    |   |-- phishguard_training_pipeline.py      # Step 2: Baseline training
    |   |-- phishguard_improved_pipeline.py      # Step 3: Phishing-focused improvement
    |   |-- phishguard_balanced_pipeline.py      # Step 4: Balanced optimization
    |   |-- phishguard_security_audit.py         # Step 5: Security audit
    |   +-- phishguard_security_optimization.py  # Step 6: Threshold optimization
    |
    |-- models/                     # Trained models and inference engines
    |   |-- improved_model.pkl              # XGBoost v2 (production model)
    |   |-- trusted_hybrid_model.pkl        # Hybrid engine (ML + trust scoring)
    |   |-- heuristic_model.pkl             # XGBoost v1 (baseline)
    |   |-- balanced_improved_model.pkl     # XGBoost v3 (balanced variant)
    |   |-- preprocessing_pipeline.pkl      # Feature scaler
    |   |-- hybrid_engine_simple.py         # Trusted Hybrid Decision Engine
    |   |-- hybrid_decision_engine.py       # Full hybrid engine
    |   |-- hybrid_engine_fast.py           # Optimized engine variant
    |   |-- hybrid_engine_trusted_fix.py    # Trust fix engine variant
    |   +-- updated_inference_module.py     # Production inference wrapper
    |
    |-- reports/                    # Evaluation metrics and analysis
    |   |-- model_metadata.json
    |   |-- model_metrics.json
    |   |-- improved_model_metrics.json
    |   |-- balanced_improvement_report.json
    |   |-- deployment_readiness.json
    |   |-- deployment_threshold.json
    |   |-- optimal_thresholds.json
    |   |-- trusted_fix_evaluation.json
    |   |-- security_impact_report.json
    |   |-- feature_groups.json
    |   |-- data_quality_report.md
    |   |-- security_audit_report.md
    |   |-- security_optimization_summary.md
    |   +-- removed_columns_report.md
    |
    |-- evaluation/                 # Detailed evaluation data
    |   |-- feature_importance.csv
    |   |-- feature_ablation_results.csv
    |   |-- threshold_analysis.csv
    |   |-- confusion_matrix_by_risk.csv
    |   |-- risk_distribution.csv
    |   |-- false_negative_analysis.csv
    |   |-- false_positive_analysis.csv
    |   |-- leakage_analysis.csv
    |   |-- improvement_comparison.txt
    |   |-- model_predictions_report.txt
    |   |-- predictions_output.txt
    |   +-- model_predictions_sample.csv
    |
    |-- visualizations/             # Charts and plots
    |   |-- confusion_matrices.png
    |   |-- calibration_curve.png
    |   |-- calibration_verification.png
    |   |-- correlation_heatmap.png
    |   |-- precision_recall_curve.png
    |   |-- phishing_recall_vs_threshold.png
    |   |-- false_positive_vs_threshold.png
    |   |-- risk_tier_distribution.png
    |   |-- phishing_detection_gain_chart.png
    |   +-- hybrid_trusted_confusion_matrix.png
    |
    +-- tests/                      # Smoke tests and verification
        |-- test_5_websites.py
        |-- test_youtube.py
        |-- test_youtube_model.py
        |-- test_youtube_simple.py
        +-- show_model_predictions.py
```

---

## Setup Instructions

### Prerequisites

- Python 3.10 or later
- pip package manager
- Google Chrome (for the extension)
- Git LFS (model files are stored with Git Large File Storage)

### 1. Clone the Repository

```bash
git lfs install
git clone https://github.com/khalilgh1/phishing-detection-tool.git
cd phishing-detection-tool
```

### 2. Create a Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

For screenshot capture functionality (optional):

```bash
playwright install firefox
```

### 4. Download the DistilBERT Model

The fine-tuned DistilBERT model weights are not included in the repository due to size constraints. Place the model files in:

```
backend/distilbert_model/distilbert-phishing-model/
```

The directory should contain `config.json`, `model.safetensors`, `tokenizer.json`, and related tokenizer files.

### 5. Start the Flask Backend

```bash
python app.py
```

The server starts on `http://localhost:5000`. Verify with:

```bash
curl http://localhost:5000/api/health
```

### 6. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the `extension/` folder
4. The Osprey icon appears in the toolbar

### 7. Using the URL Model Independently

The URL model can be used without the Flask backend for batch analysis:

```python
import joblib

# Load the trusted hybrid engine
engine = joblib.load("url_model/models/trusted_hybrid_model.pkl")

# Predict on a feature dictionary
features = {
    "url_len": 45,
    "https": 1,
    "web_ssl_valid": 1,
    "having_ip_address": 0,
    "Shortining_Service": 0,
    "abnormal_url": 0,
    "web_security_score": 5,
    # ... (all 54 features; missing features default to 0)
}

result = engine.predict(features)
print(result)
# {
#     "final_score": 0.0023,
#     "risk_level": "SAFE",
#     "decision": "ALLOW",
#     "trusted_domain_flag": True,
#     "trust_score": 0.85,
#     ...
# }
```

### 8. Reproducing the Training Pipeline

To reproduce the URL model from scratch (requires the original dataset):

```bash
cd url_model/pipelines

# Step 1: Clean and prepare the dataset
python phishguard_cleaning_pipeline.py

# Step 2: Train the baseline model
python phishguard_training_pipeline.py

# Step 3: Train the improved model
python phishguard_improved_pipeline.py

# Step 4: Train the balanced variant
python phishguard_balanced_pipeline.py

# Step 5: Run the security audit
python phishguard_security_audit.py

# Step 6: Optimize thresholds
python phishguard_security_optimization.py
```

---

## API Reference

### POST /api/predict

Classify email text as phishing or legitimate.

**Request:**
```json
{
    "text": "From: security@bank.com Subject: Urgent account verification..."
}
```

**Response:**
```json
{
    "label": 1,
    "label_name": "phishing",
    "confidence": 0.9847,
    "probabilities": {
        "legitimate": 0.0153,
        "phishing": 0.9847
    }
}
```

### POST /api/predict_visual

Analyze a page screenshot for visual similarity to known legitimate sites.

**Request:**
```json
{
    "screenshot": "<base64-encoded PNG>",
    "url": "https://suspicious-site.com/login"
}
```

**Response:**
```json
{
    "is_phishing": true,
    "reason": "Page looks like paypal.com but is on a different domain (suspicious-site.com).",
    "details": {
        "match_found": true,
        "is_visual_match": true,
        "closest_match": "paypal.com.png",
        "distance": 3,
        "threshold": 5
    }
}
```

### GET /api/health

Returns `{"status": "ok"}` if the server is running.

---

## Chrome Extension Usage

Once loaded in Chrome:

1. **Automatic Gmail scanning:** Navigate to Gmail. When opening an email, the extension extracts the sender, subject, and body, sends it to the backend, and displays a phishing risk overlay directly on the page.

2. **Manual text input:** Click the Osprey icon in the toolbar, paste email text into the input field, and click "Analyze" for an instant classification.

3. **Screenshot analysis:** The extension can capture the visible tab as a screenshot and send it for visual similarity matching against the known-site database.

---

## Known Limitations and Future Work

**Current limitations:**

- The URL model deployment readiness score is 60/100, suitable for demonstration but not production deployment.
- The adversarial robustness test showed a 49.4% prediction flip rate under random noise injection, indicating sensitivity to feature perturbation.
- The Security-Focused threshold (0.11) produces approximately 213 false alerts per 1,000 legitimate URLs. The trusted domain layer mitigates this partially but not completely.
- The DistilBERT email model and the URL model operate independently. There is no cross-layer fusion or consensus mechanism.
- The visual matching database contains approximately 50 reference screenshots. Expanding this database would improve coverage.

**Planned improvements:**

- Implement cross-layer score fusion to combine email, URL, and visual signals into a unified risk assessment.
- Expand the visual matching database with automated screenshot harvesting from the full Tranco top-10K list.
- Add adversarial training to improve robustness against feature perturbation attacks.
- Integrate the URL model into the Flask backend for real-time URL scoring from the Chrome extension.
- Implement user feedback collection to enable online learning and threshold adaptation.
