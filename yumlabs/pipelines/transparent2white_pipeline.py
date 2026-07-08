import os
from PIL import Image

def transparent2white_pipeline(
  image: str,
  width: int = 512,
  height: int = 512,
  output_dir: str = 'output',
  **kwargs,
):
  image_file = Image.open(image).convert("RGBA")
  background = Image.new("RGBA", (width, height), (255, 255, 255, 255))
  
  paste_x = (width - image_file.width) // 2
  paste_y = (height - image_file.height) // 2

  background.paste(image_file, (paste_x, paste_y), mask=image_file)

  pipe = background.convert("RGB")
  # pipe = Image.alpha_composite(background, image_file).convert("RGB")

  output = os.path.join(output_dir, "transparent2white_pipeline.png")
  pipe.save(output)
  return { "image": output }