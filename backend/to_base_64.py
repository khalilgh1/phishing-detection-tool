import base64
URL = "datasets/target_screenshots/facebook_sus_2.png"
with open(URL, "rb") as img_file:
    encoded_string = base64.b64encode(img_file.read()).decode('utf-8')

print(encoded_string)  # This is what you put in "screenshot"
