import os
from PIL import Image

def crop_pipeline(
  image: str,
  width: int,
  height: int,
  output_dir: str = 'output',
  **kwargs,
):
  img = Image.open(image)
  img_width, img_height = img.size

  left = (img_width - width) // 2
  top = (img_height - height) // 2
  right = left + width
  bottom = top + height

  pipe = img.crop((left, top, right, bottom))
  output = os.path.join(output_dir, image.split('/')[-1])
  pipe.save(output)
  return { "image": output }