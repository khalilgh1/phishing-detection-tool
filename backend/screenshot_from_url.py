import csv
from time import sleep
from playwright.sync_api import sync_playwright, Page

DATASET_PATH = "datasets/tranco_6G99X.csv"
OUTPUT_DIR = "datasets/screenshots2/"
TIMEOUT = 30000
LIMIT = 250
START_FROM = 1342
count = 1

def capture_screenshot_from_url(url: str, filename: str, page: Page) -> None:
    """Captures a screenshot of URL using Playwright Firefox"""
    page.goto(url, wait_until="networkidle", timeout=TIMEOUT)
    page.screenshot(path=filename)

with sync_playwright() as p:
    browser = p.firefox.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
    context = browser.new_context()
    page = context.new_page()

    with open(DATASET_PATH, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)

        for row in reader:

            domain = row[1].strip()
            print(f"Processing {domain} ({count}/{LIMIT})")

            for protocol in ["https://", "http://"]:
                url = protocol + domain

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)

                    selectors = [
                        "form",                                     # Standard form tag
                        "section:has(input[type='password'])",      # Section containing password
                        "div:has(input[type='password'])"           # Div containing password
                        "div[id*='login']",                         # Divs with 'login' in ID
                        "div[class*='login']",                      # Divs with 'login' in Class
                    ]
                    target_element = None
                    for selector in selectors:
                        element = page.query_selector(selector)
                        if element and element.is_visible():
                            target_element = element
                            break
                    # 4. Take the Cropped Screenshot
                    if target_element:
                        print(f"Match found using selector: {selector}")
                        target_element.screenshot(path=OUTPUT_DIR + url.split('/')[-1] + ".png")
                        break
                    else:
                        print("No specific form found, taking full page screenshot.")
                        page.screenshot(path=OUTPUT_DIR + url.split('/')[-1] + ".png")

                    break
                except:
                    continue

    browser.close()
