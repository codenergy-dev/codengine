import os
from PIL import Image

def copy_image_pipeline(
    image: str,
    name: str = None,
    output_dir: str = "output",
    **kwargs,
):
    image_file = Image.open(image)

    output_name = (image if name is None else name).split("/")[-1]
    output = os.path.join(output_dir, output_name)

    os.makedirs(output_dir, exist_ok=True)

    ext = output_name.lower().split(".")[-1]

    if ext in ("jpg", "jpeg") and image_file.mode == "RGBA":
        image_file = image_file.convert("RGB")

    image_file.save(output)

    return {"image": output}
