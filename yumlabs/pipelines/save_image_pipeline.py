import os

def save_image_pipeline(
  image,
  name: str,
  output_dir: str = "output",
  **kwargs,
):
  output = os.path.join(output_dir, name.split("/")[-1])
  image.save(output)
  return { "image": output }