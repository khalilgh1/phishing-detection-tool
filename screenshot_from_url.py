import csv
from time import sleep
from playwright.sync_api import sync_playwright, Page

DATASET_PATH = "datasets/tranco_6G99X.csv"
OUTPUT_DIR = "datasets/screenshots/"
TIMEOUT = 30000
LIMIT = 250
START_FROM = 1342
count = 1

def capture_screenshot_from_url(url: str, filename: str, page: Page) -> None:
    """Captures a screenshot of URL using Playwright Firefox"""
    page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT)
    page.screenshot(path=filename)

with sync_playwright() as p:
    browser = p.firefox.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
    context = browser.new_context()
    page = context.new_page()

    with open(DATASET_PATH, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)

        for index, row in enumerate(reader, start=1):

            if index < START_FROM:
                continue

            domain = row[1].strip()

            for protocol in ["https://", "http://"]:
                url = protocol + domain

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)

                    if page.locator("input[type='password']").count() > 0 and count <= LIMIT:
                        capture_screenshot_from_url(
                            url=url,
                            filename=OUTPUT_DIR + url.split('/')[-1] + ".png",
                            page=page
                        )
                        print(f"{count}- Saved Screenshot of {url}")
                        count += 1
                    else:
                        print(url)

                    sleep(1)
                    break
                except:
                    continue

    browser.close()
