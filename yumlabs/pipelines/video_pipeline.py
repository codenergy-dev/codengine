import cv2
import os
from glob import glob

def video_pipeline(
  frames_dir: str,
  output_dir: str = "output",
  fps: int = 1,
  **kwargs,
):
  output = os.path.join(output_dir, "video_pipeline.mp4")
  images = sorted(glob(os.path.join(frames_dir, '*.jpg')))

  frame = cv2.imread(images[0])
  height, width, layers = frame.shape
  size = (width, height)

  fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # ou 'XVID' para .avi
  out = cv2.VideoWriter(output, fourcc, fps, size)

  for image_path in images:
    frame = cv2.imread(image_path)
    out.write(frame)

  out.release()
  return { "video": output }