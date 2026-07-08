import os

def foreach_image_pipeline(
  dir: str,
  **kwargs,
):
  images = [
    os.path.join(dir, f)
    for f in os.listdir(dir)
    if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
  ]

  output = []
  for image in images:
    output.append({ "image": image })

  return output
