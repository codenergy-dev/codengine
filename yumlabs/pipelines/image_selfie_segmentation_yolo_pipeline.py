import cv2
import numpy as np
from ultralytics import YOLO

def image_selfie_segmentation_yolo_pipeline(
  image: str,
  model_size: str = 'n',
  output_dir: str = 'output',
  **kwargs,
):
  image_bgr = cv2.imread(image)
  
  model = YOLO(f"yolov8{model_size}-seg.pt")
  h, w, _ = image_bgr.shape
  results = model.predict(image_bgr, verbose=False)

  output = np.zeros((h, w, 4), dtype=np.uint8)
  for r in results:
    if r.masks is None:
      continue
    for mask, cls in zip(r.masks.data, r.boxes.cls):
      if int(cls) == 0:
        mask = mask.cpu().numpy().astype(np.uint8)
        mask = cv2.resize(mask, (w, h))

        mask = cv2.GaussianBlur(mask.astype(np.float32), (5,5), 0)
        mask = (mask > 0.5).astype(np.uint8)

        output[..., :3] = image_bgr
        output[..., 3] = (mask * 255).astype(np.uint8)

        break

  output_path = f"{output_dir}/image_selfie_segmentation_yolo_pipeline.png"
  cv2.imwrite(output_path, output)
  
  return { "image": output_path }