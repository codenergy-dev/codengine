import os
import shutil

def clear_dir_pipeline(
  dir: str = "output",
  **kwargs,
):
  if os.path.exists(dir):
    shutil.rmtree(dir)
  os.makedirs(dir)
  return {}