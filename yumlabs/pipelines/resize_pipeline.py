import os
from PIL import Image, ImageOps

def resize_pipeline(
  image: str,
  width: int = 512,
  height: int = 512,
  output_dir: str = "output",
  resample: str = "LANCZOS",
  **kwargs,
):
  resample_methods = {
    "NEAREST": Image.NEAREST,
    "BILINEAR": Image.BILINEAR,
    "BICUBIC": Image.BICUBIC,
    "LANCZOS": Image.LANCZOS,
  }

  method = resample_methods.get(resample.upper(), Image.LANCZOS)

  image_file = Image.open(image).convert("RGBA")
  pipe = ImageOps.pad(image_file, (width, height), color=(255, 255, 255, 0), centering=(0.5, 0.5), method=method)

  os.makedirs(output_dir, exist_ok=True)
  output = os.path.join(output_dir, "resize_pipeline.png")
  pipe.save(output)
  return { "image": output }
