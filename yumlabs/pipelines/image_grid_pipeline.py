import os
from PIL import Image
import math

def image_grid_pipeline(
  dir: str,
  width: int,
  height: int,
  grid_size: int = None,
  output_dir: str = 'output',
  **kwargs,
):
  supported_exts = ('.png', '.jpg', '.jpeg', '.webp', '.bmp')
  image_files = sorted([
    os.path.join(dir, f)
    for f in os.listdir(dir)
    if f.lower().endswith(supported_exts)
  ])

  if not image_files:
    raise ValueError(f"Nenhuma imagem encontrada em: {dir}")

  images = [Image.open(path) for path in image_files]
  
  num_images = len(images)
  
  if grid_size is None:
    grid_size = math.ceil(math.sqrt(num_images))

  images_per_grid = grid_size * grid_size
  num_grids = math.ceil(num_images / images_per_grid)

  os.makedirs(output_dir, exist_ok=True)
  output = []

  for g in range(num_grids):
    grid_img = Image.new('RGB', (width * grid_size, height * grid_size), color='white')
    for i in range(images_per_grid):
      idx = g * images_per_grid + i
      if idx >= num_images:
        break
      img = images[idx].resize((width, height))
      row = i // grid_size
      col = i % grid_size
      grid_img.paste(img, (col * width, row * height))
    
    output_path = os.path.join(output_dir, f"image_grid_pipeline_{g + 1}.png")
    grid_img.save(output_path)
    output.append({ "image": output_path })

  return output