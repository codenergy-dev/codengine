import os
import torch
from PIL import Image
from RealESRGAN import RealESRGAN

def image_restoration_pipeline(
  image: str,
  scale: int = 2,
  output_dir: str = 'output',
  venv: str = 'realesrgan',
  **kwargs,
):
  device = torch.device('cpu')
  model = RealESRGAN(device, scale=scale)
  model.load_weights(f'weights/RealESRGAN_x{scale}.pth', download=True)

  image_file = Image.open(image).convert('RGB')
  sr_image = model.predict(image_file)

  output = os.path.join(output_dir, "image_restoration_pipeline.png")
  sr_image.save(output)
  
  return { "image": output }