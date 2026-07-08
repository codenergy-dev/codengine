import os
from PIL import Image
import numpy as np

def crop_segmentation_pipeline(
  image: str,
  output_dir: str = 'output',
  **kwargs,
):
  # Abre a imagem com canal alfa
  image_file = Image.open(image).convert("RGBA")
  np_image = np.array(image_file)

  # Extrai o canal alfa
  alpha = np_image[:, :, 3]

  # Cria uma máscara onde alfa > 0 (foreground)
  mask = alpha > 100

  # Se não houver nenhum pixel visível
  if not np.any(mask):
    print("Nenhum foreground encontrado.")
    return None

  # Bounding box do foreground
  coords = np.argwhere(mask)
  y0, x0 = coords.min(axis=0)
  y1, x1 = coords.max(axis=0) + 1  # +1 para incluir o pixel final

  # Recorta a imagem inteira (incluindo canal alfa)
  cropped = np_image[y0:y1, x0:x1]

  # Converte de volta pra PIL e salva
  output = os.path.join(output_dir, "crop_segmentation_pipeline.png")
  cropped_image = Image.fromarray(cropped, mode="RGBA")
  cropped_image.save(output)

  return { "image": output }
