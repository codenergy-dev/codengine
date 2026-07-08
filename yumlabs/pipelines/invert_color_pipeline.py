import os
from PIL import Image, ImageOps

def invert_color_pipeline(
  image: str,
  output_dir: str = "output",
  **kwargs,
):
  image_file = Image.open(image).convert("RGB")
  output = os.path.join(output_dir, "invert_color_pipeline.png")
  pipe = ImageOps.invert(image_file)
  pipe.save(output)
  return { "image": output }