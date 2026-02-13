from PIL import Image
from imagehash import phash
from pathlib import Path
from check_url_legitimacy import check_url_legitimacy
import io
import base64

DATABASE = None
SCREENSHOTS_DIR = Path("datasets/screenshots2/")
THRESHOLD = 15  # Standard threshold for pHash
TARGET_SIZE = (1280, 720)
TARGET_SCREENSHOT_PATH = "datasets/target_screenshots/facebook_sus_2.png"


def process_image(image: Image.Image) -> Image.Image:
    """
        Standardize the image:
        1. Convert to RGB (removes alpha channel issues).
        2. Resize to a fixed 1280x720 (fixes Aspect Ratio issues).
    """
    if image.mode != "RGB":
        image = image.convert("RGB")


    # Force resize to match the database standard
    return image.resize(TARGET_SIZE, Image.Resampling.LANCZOS)

def get_dominant_color(image: Image.Image):
    """
    Returns the most frequent color in the image (simplified).
    Used to prevent a 'Red' site from matching a 'Blue' site.
    """
    # Resize to tiny icon to merge pixels and find dominant color
    tiny_img = image.resize((50, 50))
    result = tiny_img.convert('P', palette=Image.ADAPTIVE, colors=1)
    result.putalpha(0)
    colors = result.getcolors(50*50)
    # Return the most common color tuple (R, G, B)
    return colors[0][1]


def _load_database():
    """Load or initialize the database of known site hashes."""
    global DATABASE
    if DATABASE is None:
        DATABASE = []
        for image_path in SCREENSHOTS_DIR.iterdir():
            if image_path.name.startswith("."):
                continue
            try:
                # Load and process the image before hashing
                raw_img = Image.open(image_path)
                processed_img = process_image(raw_img)
                item = {
                    "name": image_path.name,
                    "hash": phash(processed_img),
                    "original_path": str(image_path)
                }
                DATABASE.append(item)
            except Exception as exception:
                print(f"Could not process {image_path.name}: {exception}")
    return DATABASE


def find_visual_match(image_base64: str):
    """
    Find the best visual match for a given image against the database.

    Args:
        image_base64: A base64-encoded string of the image to check.

    Returns:
        A dictionary with match information or None.
    """
    db = _load_database()
    if not db:
        return None

    try:
        # Decode the base64 string
        image_data = base64.b64decode(image_base64)
        raw_image = Image.open(io.BytesIO(image_data))

        # Process the input image
        target_image = process_image(raw_image)
        target_hash = phash(target_image)
    except Exception as exception:
        print(f"Error processing input image: {exception}")
        return None

    min_distance = float('inf')
    best_match_item = None

    for item in db:
        distance = item['hash'] - target_hash
        print(f"Item: {item['name']}, Distance: {distance}")
        if distance < min_distance:
            min_distance = distance
            best_match_item = item
        if min_distance == 0:
            break

    if best_match_item:
        is_match = min_distance <= THRESHOLD

        confidence = "High" if min_distance < 5 else "Medium" if min_distance < 15 else "Low"

        return {
            "match_found": True,
            "is_visual_match": is_match,
            "closest_match": best_match_item['name'],
            "distance": min_distance,
            "threshold": THRESHOLD,
            "confidence": confidence
        }

    return {"match_found": False}




if __name__ == '__main__':
    # Example usage:
    # This part will only run when the script is executed directly
    print("Loading database...")
    _load_database()
    print(f"Database loaded with {len(DATABASE)} items.")

    # Example with a test image (replace with a valid image for testing)
    try:
        with open(TARGET_SCREENSHOT_PATH, "rb") as f:
            test_image_base64 = base64.b64encode(f.read()).decode('utf-8')

        result = find_visual_match(test_image_base64)
        print("\n--- Test Run ---")
        if result:
            print(f"Test Results:\n")
            print(f"Match Found: {result['match_found']}")
            print(f"Is Visual Match: {result['is_visual_match']}")
            print(f"Closest Match: {result['closest_match']}")
            print(f"Distance: {result['distance']}")
            print(f"Threshold: {result['threshold']}")
            print(f"Confidence: {result['confidence']}")
            if result.get("is_visual_match"):
                print("Conclusion: Visual Match Detected, Proceed to URL check!")
            else:
                print("Conclusion: Visual Difference Is Significant.")
        else:
            print("No result from find_visual_match.")
        print("----------------\n")

    except FileNotFoundError:
        print("\nRun this script from the root directory of the project to test it.")
    except Exception as e:
        print(f"An error occurred during the test run: {e}")

    if result['is_visual_match']:
        print("Visual Match Detected, Proceed to URL check!")
        final_verdict = check_url_legitimacy('http://123contactform.com', result['closest_match'])
        print(f"Verdict: {final_verdict['status']} - {final_verdict['reason']}")
    else:
        print("Visual Difference Is Significant.")