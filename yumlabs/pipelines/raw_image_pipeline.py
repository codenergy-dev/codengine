import os
import requests
from PIL import Image, ImageOps
from io import BytesIO

def raw_image_pipeline(
  image: str,
  output_dir: str = 'output',
  **kwargs,
):
  output = image
  if image.startswith('https'):
    response = requests.get(image)
    
    pipe = Image.open(BytesIO(response.content)).convert("RGB")
    output = os.path.join(output_dir, 'raw_image_pipeline.png')
    pipe.save(output)
  return { "image": output }