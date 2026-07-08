import os

def download_image_pipeline(path: str, response, **kwargs):
  data = response.read()
  os.makedirs(os.path.dirname(path), exist_ok=True)
  with open(path, "wb") as f:
    f.write(data)
  return { "image": path }