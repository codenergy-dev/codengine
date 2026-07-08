import torch
from diffusers import T2IAdapter

def t2iadapter_pipeline(
  torch_dtype: str = 'float16',
  **kwargs,
):
  torch_dtype = torch.float16 if torch_dtype == 'float16' else torch.float32
  adapter = []
  image = []
  for key, value in kwargs.items():
    if key == "canny":
      adapter.append(T2IAdapter.from_pretrained("TencentARC/t2iadapter_canny_sd14v1", torch_dtype=torch_dtype))
      image.append(value)
    if key == "color":
      adapter.append(T2IAdapter.from_pretrained("TencentARC/t2iadapter_color_sd14v1", torch_dtype=torch_dtype))
      image.append(value)
    if key == "sketch":
      adapter.append(T2IAdapter.from_pretrained("TencentARC/t2iadapter_sketch_sd14v1", torch_dtype=torch_dtype))
      image.append(value)
  return { "adapter": adapter, "image": image }