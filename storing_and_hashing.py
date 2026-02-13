from PIL import Image
from imagehash import phash

# 1. Load your "Golden" Reference Image (The Real PayPal)
# In a real app, you'd load this from your database
ref_image = Image.open("datasets/screenshots/paypal.com.png")
ref_hash = phash(ref_image)

print(f"Stored Hash for PayPal: {ref_hash}")

# 2. Load the Suspicious Image (captured by Playwright/Selenium)
suspicious_image = Image.open("datasets/screenshots/suspicious_paypal.png")
suspicious_hash = phash(suspicious_image)
print(f"Stored Hash for suspicious PayPal: {suspicious_hash}")

# 3. Calculate the Difference (Hamming Distance)
distance = ref_hash - suspicious_hash

print(f"Difference Score: {distance}")

# 4. The Decision Logic
THRESHOLD = 5  # Standard threshold for pHash

if distance <= THRESHOLD:
    print("Visual Match Detected! Checking URL...")
    # Add your URL check logic here:
    # if current_domain != "paypal.com":
    #     ALERT_PHISHING()
else:
    print("Page looks different. Likely safe or a different brand.")