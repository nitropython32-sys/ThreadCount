from dotenv import load_dotenv
import moondream as md
from PIL import Image
import os

load_dotenv()

# Initialize with API key (or endpoint="http://localhost:2020/v1" for local)
model = md.vl(api_key=os.environ.get("MOONDREAM_API_KEY"))

def ObjDetect(img):

    # Load an image
    image = Image.open(img)
    # Detect objects (e.g., "person", "car", etc.)
    result = model.detect(image, "find the bolt in the image")
    detections = result["objects"]

    return detections