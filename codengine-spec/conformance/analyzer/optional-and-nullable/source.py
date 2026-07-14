from typing import Optional


def resize(width: int, height: int = 100, ratio: Optional[float] = None):
    return {"width": width, "height": height, "ratio": ratio}
