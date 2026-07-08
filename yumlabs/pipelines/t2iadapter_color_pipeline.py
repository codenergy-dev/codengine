import os
from PIL import Image

def t2iadapter_color_pipeline(
  image: str,
  width: int = 512,
  height: int = 512,
  output_dir: str = "output",
  **kwargs,
):
  image_file = Image.open(image)
  color_palette = image_file.resize((8, 8))
  color_palette = color_palette.resize((width, height), resample=Image.Resampling.NEAREST)
  output = os.path.join(output_dir, "t2iadapter_color_pipeline.png")
  color_palette.save(output)
  return { "color": output }