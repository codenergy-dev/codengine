import math
import os
from PIL import Image, PngImagePlugin
import torch
import random

def auto_pipeline(
  pipe,
  model: str,
  prompt: str,
  negative_prompt: str = None,
  image: str = None,
  controlnet: list[str] = [],
  lora: str = None,
  seed: int = None,
  count: int = 1,
  num_inference_steps: int = 2,
  guidance_scale: float = 7.5,
  output_dir: str = 'output',
  progress: bool = False,
  width: int = 512,
  height: int = 512,
  strength: float = None,
  denoising_start: float = 0,
  denoising_end: float = 1.0,
  controlnet_conditioning_scale: float = 0.5,
  control_guidance_start: float = 0.0,
  control_guidance_end: float = 1.0,
  **kwargs,
):
  if isinstance(controlnet, str):
    controlnet = controlnet.split(',')

  output = []
  for i in range(count):
    current_seed = random.randint(1, 2**32 - 1) if seed is None else seed
    generator = torch.manual_seed(current_seed)
    last_num_inference_steps = 0

    for num_inference_steps in range(1 if progress else num_inference_steps, num_inference_steps + 1):
      curr_num_inference_steps = math.floor(num_inference_steps * (strength if strength else (denoising_end - denoising_start)))
      if curr_num_inference_steps == last_num_inference_steps:
        continue
      elif curr_num_inference_steps >= 1:
        last_num_inference_steps = curr_num_inference_steps
        meta = PngImagePlugin.PngInfo()
        meta.add_text("pipeline", "img2img" if image is not None else "txt2img")
        meta.add_text("model", model)
        meta.add_text("lora", f"{lora}")
        meta.add_text("prompt", prompt)
        meta.add_text("negative_prompt", f"{negative_prompt}")
        meta.add_text("image", f"{image}")
        meta.add_text("control_image", f"{controlnet}")
        meta.add_text("num_inference_steps", f"{num_inference_steps}")
        meta.add_text("guidance_scale", f"{guidance_scale}")
        meta.add_text("seed", f"{current_seed}")
        meta.add_text("strength", f"{strength}")
        meta.add_text("denoising_start", f"{denoising_start}")
        meta.add_text("denoising_end", f"{denoising_end}")
        meta.add_text("controlnet_conditioning_scale", f"{controlnet_conditioning_scale}")
        meta.add_text("control_guidance_start", f"{control_guidance_start}")
        meta.add_text("control_guidance_end", f"{control_guidance_end}")
        output.append({
          "image": os.path.join(output_dir, f"seed_{current_seed}_step_{num_inference_steps:02}.png")
        })
        pipe(
          prompt=prompt,
          negative_prompt=negative_prompt,
          image=Image.open(image).convert("RGB") if image is not None else [Image.open(preprocessor).convert("RGB") for preprocessor in controlnet],
          control_image=[Image.open(preprocessor).convert("RGB") for preprocessor in controlnet],
          num_inference_steps=num_inference_steps,
          guidance_scale=guidance_scale,
          generator=generator,
          width=width,
          height=height,
          strength=strength,
          denoising_start=None if strength else denoising_start,
          denoising_end=None if strength else denoising_end,
          controlnet_conditioning_scale=[controlnet_conditioning_scale for preprocessor in controlnet],
          control_guidance_start=control_guidance_start,
          control_guidance_end=control_guidance_end,
        ).images[0].save(output[-1]["image"], pnginfo=meta)
  return output