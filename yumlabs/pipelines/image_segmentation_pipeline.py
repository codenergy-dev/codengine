import os
from ben2 import BEN_Base
from PIL import Image
import torch

def image_segmentation_pipeline(
  image: str,
  output_dir: str = 'output',
  venv: str = 'ben2',
  **kwargs,
):
  image_file = Image.open(image).convert("RGB")

  device = torch.device("cpu")
  model = BEN_Base.from_pretrained("PramaLLC/BEN2")
  model.to(device).eval()
  
  pipe = model.inference(image_file, refine_foreground=False)
  output = os.path.join(output_dir, 'image_segmentation_pipeline.png')
  pipe.save(output)
  return { "image": output }