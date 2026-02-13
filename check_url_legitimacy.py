import tldextract
from math import log
from pathlib import Path

# Mapping of the database image names to their official domains
SCREENSHOTS_DIR = Path("datasets/screenshots/")
BRAND_MAP = {}
for image_path in SCREENSHOTS_DIR.iterdir():
    BRAND_MAP[image_path.name] = image_path.stem
###############################################################


def calculate_entropy(domain):
    """Calculates the Shannon entropy of a domain string."""
    prob = [float(domain.count(c)) / len(domain) for c in dict.fromkeys(list(domain))]
    entropy = - sum([p * log(p) / log(2.0) for p in prob])
    return entropy

def check_url_legitimacy(actual_url, matched_image_name):
    # 1. Get official domain for the visual match
    expected_domain = BRAND_MAP.get(matched_image_name)

    # 2. Parse the actual URL
    extracted = tldextract.extract(actual_url)
    actual_registered_domain = f"{extracted.domain}.{extracted.suffix}"

    print(f"Visual Match: {expected_domain} | Visiting: {actual_registered_domain}")

    # 3. Decision Logic
    if actual_registered_domain == expected_domain:
        return {"status": "SAFE", "reason": "Visuals match the official domain."}

    # 4. Heuristic Analysis for Suspicious URLs
    entropy = calculate_entropy(actual_registered_domain)

    if expected_domain in actual_url: # e.g., 'paypal.com.secure-update.xyz'
        return {
            "status": "PHISHING",
            "reason": f"Deceptive URL: {expected_domain} found in subdomain of {actual_registered_domain}."
        }

    if entropy > 3.5: # Example threshold for random domains
        return {"status": "PHISHING", "reason": "High entropy (random) domain detected."}

    return {"status": "PHISHING", "reason": "Visual match found but domain is unauthorized."}