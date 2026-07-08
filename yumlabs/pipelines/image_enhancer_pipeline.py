import os
from PIL import Image, ImageEnhance, ImageStat
import numpy as np
import cv2

def image_enhancer_pipeline(
  image: str,
  output_dir: str = 'output',
  **kwargs,
):
  image_file = Image.open(image).convert("RGBA")

  image_file = adjust_brightness(image_file)
  image_file = adjust_contrast(image_file)
  image_file = adjust_sharpness(image_file)

  output = os.path.join(output_dir, "image_enhancer_pipeline.png")
  image_file.save(output)
  
  return { "image": output }

def get_brightness(image):
  grayscale = image.convert("L")
  stat = ImageStat.Stat(grayscale)
  return stat.mean[0]  # 0 (dark) to 255 (bright)

def get_contrast(image):
  grayscale = image.convert("L")
  stat = ImageStat.Stat(grayscale)
  return stat.stddev[0]  # Higher = more contrast

def get_sharpness(image):
  gray = np.array(image.convert("L"))
  laplacian = cv2.Laplacian(gray, cv2.CV_64F)
  return laplacian.var()  # Higher = sharper

def adjust_brightness(image, target=130):
  current = get_brightness(image)
  factor = target / current if current != 0 else 1
  return ImageEnhance.Brightness(image).enhance(factor)

def adjust_contrast(image, target=60):
  current = get_contrast(image)
  factor = target / current if current != 0 else 1
  return ImageEnhance.Contrast(image).enhance(factor)

def adjust_sharpness(image, target=30):
  current = get_sharpness(image)
  factor = target / current if current != 0 else 1
  return ImageEnhance.Sharpness(image).enhance(factor)