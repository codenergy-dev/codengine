import os
from PIL import Image

def image_merge_pipeline(
    output_dir: str = "output",
    **kwargs,
):
    image_keys = sorted(
        [k for k in kwargs.keys() if k.startswith("image")],
        key=lambda x: (len(x), x)
    )

    if not image_keys:
        raise ValueError("At least one image path is required (e.g. image, image_1, image_2 etc).")

    images: list[Image.Image] = []
    for key in image_keys:
        image_path = kwargs[key]

        if isinstance(image_path, str):
            image = Image.open(image_path).convert("RGBA")

        else:
            raise TypeError(f"Invalid '{key}' type: {type(image_path)}")

        images.append(image)

    image_merge = images[0].copy()

    for img in images[1:]:
        image_merge.alpha_composite(img)

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "image_merge_pipeline.png")
    image_merge.save(output_path)

    return {"image": output_path}
