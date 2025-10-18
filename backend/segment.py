import sys
import json
from transformers import Sam2Processor, Sam2Model, infer_device, SamHQModel, SamHQProcessor
import torch
from PIL import Image
import requests

def segment_image(image_path, bbox):
    device = infer_device()
    model = Sam2Model.from_pretrained("facebook/sam2.1-hiera-large").to(device)
    processor = Sam2Processor.from_pretrained("facebook/sam2.1-hiera-large")

    if image_path.startswith('http'):
        raw_image = Image.open(requests.get(image_path, stream=True).raw).convert("RGB")
    else:
        raw_image = Image.open(image_path).convert("RGB")

    input_boxes = [[bbox]]
    inputs = processor(images=raw_image, input_boxes=input_boxes, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = model(**inputs)

    masks = processor.post_process_masks(outputs.pred_masks.cpu(), inputs["original_sizes"])[0]
    return masks[0].numpy().tolist()




if __name__ == "__main__":
    for line in sys.stdin:
        data = json.loads(line)
        image_path = data['image_path']
        bbox = data['bbox']
        mask = segment_image(image_path, bbox)
        # mask = segment_image_high(image_path, bbox)
        print(json.dumps(mask))