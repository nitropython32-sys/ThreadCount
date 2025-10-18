import base64
import io
import sys
import subprocess
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from obj_detect import ObjDetect
from PIL import Image

app = Flask(__name__)
# Allow requests from your React dev server (port 3000)
CORS(app, resources={r"/*": {"origins": ["https://192.168.4.88:3000"]}})
@app.route("/")
def hello_world():
    return jsonify(message="Hello, World!")

@app.route("/upload", methods=['POST'])
def upload():
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify(status="error", message="No image data provided"), 400

    # Decode the image data
    header, encoded = data['image'].split(",", 1)
    image_data = base64.b64decode(encoded)

    # Save the full-resolution image
    full_res_path = "snapshot.png"
    with open(full_res_path, "wb") as f:
        f.write(image_data)

    # --- Step 1: Object Detection on Full-Resolution Image ---
    detections = ObjDetect(img=full_res_path)
    print("Detections:", detections)

    processed_image_b64 = None
    processed_crop_path = "processed_crop.png"

    # Get image dimensions for coordinate calculation
    with Image.open(full_res_path) as full_res_image:
        width, height = full_res_image.size

        # --- Step 2: Crop, Resize, and Segment for each detection ---
        # (Assuming one detection for simplicity, can be expanded)
        if detections:
            detection = detections[0]
            # Calculate bounding box coordinates on the full-res image
            x_min = detection['x_min'] * width
            y_min = detection['y_min'] * height
            x_max = detection['x_max'] * width
            y_max = detection['y_max'] * height
            
            # Crop the detected object from the full-resolution image
            bbox = (x_min, y_min, x_max, y_max)
            cropped_image = full_res_image.crop(bbox)
            
            print("Cropped image size:", cropped_image.size)

            # Resize the cropped image to the target size for the segmentation model
            target_size = (1024,1024)
            resized_image = cropped_image.resize(target_size, Image.Resampling.LANCZOS)

            # Save the processed image to a file
            resized_image.save(processed_crop_path)

            # The new bounding box for the segmentation model is the entire image
            segment_bbox = [0, 0, target_size[0], target_size[1]]

            script_input = json.dumps({
                "image_path": processed_crop_path,
                "bbox": segment_bbox
            })

            try:
                # Call segmentation script on the new cropped and resized image
                process = subprocess.Popen(
                    [sys.executable, "segment.py"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=app.root_path
                )
                stdout, stderr = process.communicate(script_input + '\n')

                if process.returncode == 0:
                    mask = json.loads(stdout)
                    detection['mask'] = mask
                else:
                    print(f"Error segmenting detection: {stderr}", file=sys.stderr)
            except FileNotFoundError:
                print("Error: 'segment.py' not found. Make sure the script is in the 'backend' directory.", file=sys.stderr)
            except Exception as e:
                print(f"Failed to run segmentation script: {e}", file=sys.stderr)

            # --- Step 3: Encode processed image to send back ---
            with open(processed_crop_path, "rb") as f:
                processed_image_data = f.read()
                processed_image_b64 = f"data:image/png;base64,{base64.b64encode(processed_image_data).decode('utf-8')}"

    return jsonify(status="success", detections=detections, processed_image=processed_image_b64)
