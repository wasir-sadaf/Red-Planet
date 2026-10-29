
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image

# Input: original NASA dataset
PROJECT_DIR = Path(__file__).resolve().parent

INPUT_TIF = (
    PROJECT_DIR
    / "textures"
    / "Mars_Viking_ClrMosaic_global_925m.tif"
)

# Output: optimized texture for Three.js
OUTPUT_JPG = PROJECT_DIR / "textures" / "mars-color.jpg"

# 8192 x 4096 is detailed enough for our initial globe
OUTPUT_WIDTH = 8192
OUTPUT_HEIGHT = 4096


def main():
    if not INPUT_TIF.exists():
        raise FileNotFoundError(f"NASA dataset not found: {INPUT_TIF}")

    print("Opening NASA Mars dataset...")

    with rasterio.open(INPUT_TIF) as src:
        print(f"Original size: {src.width} x {src.height}")
        print(f"Color bands: {src.count}")

        if src.count < 3:
            raise ValueError("Expected at least 3 RGB color bands.")

        print(
            f"Resizing to {OUTPUT_WIDTH} x {OUTPUT_HEIGHT}..."
        )

        # Read at a smaller resolution to reduce memory usage.
        # Keep the original RGB values; do not mask black pixels.
        rgb = src.read(
            indexes=[1, 2, 3],
            out_shape=(3, OUTPUT_HEIGHT, OUTPUT_WIDTH),
            resampling=Resampling.bilinear,
        )

    # Convert from (bands, height, width) to (height, width, bands)
    rgb = np.moveaxis(rgb, 0, -1)

    image = Image.fromarray(rgb.astype(np.uint8), mode="RGB")

    print("Saving optimized JPEG texture...")

    image.save(
        OUTPUT_JPG,
        format="JPEG",
        quality=92,
        optimize=True,
        progressive=True,
    )

    print("\nConversion complete!")
    print(f"Output: {OUTPUT_JPG}")
    print(f"Dimensions: {image.width} x {image.height}")
    print(f"File size: {OUTPUT_JPG.stat().st_size / (1024 * 1024):.1f} MB")


if __name__ == "__main__":
    main()
