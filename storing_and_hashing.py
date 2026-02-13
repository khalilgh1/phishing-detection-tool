from PIL import Image
from imagehash import phash
from pathlib import Path
import io
import base64

DATABASE = None
SCREENSHOTS_DIR = Path("datasets/screenshots")
THRESHOLD = 5  # Standard threshold for pHash


def _load_database():
    """Load or initialize the database of known site hashes."""
    global DATABASE
    if DATABASE is None:
        DATABASE = []
        for image_path in SCREENSHOTS_DIR.iterdir():
            if image_path.name.startswith("."):
                continue
            try:
                item = {
                    "name": image_path.name,
                    "hash": phash(Image.open(image_path))
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
        image = Image.open(io.BytesIO(image_data))
        target_hash = phash(image)
    except Exception as exception:
        print(f"Error processing input image: {exception}")
        return None

    min_distance = float('inf')
    best_match_item = None

    for item in db:
        distance = item['hash'] - target_hash
        if distance < min_distance:
            min_distance = distance
            best_match_item = item
        if min_distance == 0:
            break

    if best_match_item:
        is_match = min_distance <= THRESHOLD
        return {
            "match_found": True,
            "is_visual_match": is_match,
            "closest_match": best_match_item['name'],
            "distance": min_distance,
            "threshold": THRESHOLD
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
        with open("datasets/target_screenshots/suspicious_office_2.png", "rb") as f:
            test_image_base64 = base64.b64encode(f.read()).decode('utf-8')

        result = find_visual_match(test_image_base64)
        print("\n--- Test Run ---")
        if result:
            print(f"Test Result: {result}")
            if result.get("is_visual_match"):
                print("Conclusion: Visual Match Detected!")
            else:
                print("Conclusion: Page looks different.")
        else:
            print("No result from find_visual_match.")
        print("----------------\n")

    except FileNotFoundError:
        print("\nRun this script from the root directory of the project to test it.")
    except Exception as e:
        print(f"An error occurred during the test run: {e}")
