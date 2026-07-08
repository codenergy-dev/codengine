from PIL import Image

def mask(source: str, target: str, **kwargs):
  mask_img = Image.open(source).convert("RGBA")
  target_img = Image.open(target).convert("RGB")
  alpha = mask_img.getchannel("A")
  target_rgba = target_img.convert("RGBA")
  target_pixels = target_rgba.load()
  alpha_pixels = alpha.load()

  for y in range(target_img.height):
      for x in range(target_img.width):
          if alpha_pixels[x, y] == 0:
              target_pixels[x, y] = (0, 0, 0, 255)

  final_img = target_rgba.convert("RGB")
  final_img.save(target)
  return { "image": target }