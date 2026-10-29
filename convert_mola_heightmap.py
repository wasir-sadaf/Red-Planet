
from pathlib import Path

import numpy as np
from PIL import Image

PROJECT_DIR = Path(__file__).resolve().parent
INPUT_FILE = PROJECT_DIR / "textures" / "megt90n000eb.circ"
OUTPUT_FILE = PROJECT_DIR / "textures" / "mars-height.png"

WIDTH = 5760
HEIGHT = 2880

# MOLA topography is stored as signed 16-bit elevation values.
# Try big-endian first, as indicated by the initial file bytes.
def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"File not found: {INPUT_FILE}")

    expected_bytes = WIDTH * HEIGHT * 2
    actual_bytes = INPUT_FILE.stat().st_size

    if actual_bytes != expected_bytes:
        raise ValueError(
            f"Unexpected file size: {actual_bytes:,} bytes. "
            f"Expected {expected_bytes:,} bytes."
        )

    print("Reading MOLA elevation grid...")
    elevation = np.fromfile(INPUT_FILE, dtype=">i2")
    elevation = elevation.reshape((HEIGHT, WIDTH))

    print(f"Grid: {WIDTH} x {HEIGHT}")
    print(f"Minimum: {elevation.min()} m")
    print(f"Maximum: {elevation.max()} m")
    print(f"Mean: {elevation.mean():.1f} m")

    # Convert elevation values into grayscale.
    # This range is for visualization, not scientific measurements.
    low_m = -8000
    high_m = 22000

    normalized = (elevation.astype(np.float32) - low_m) / (
        high_m - low_m
    )
    normalized = np.clip(normalized, 0, 1)

    grayscale = (normalized * 255).astype(np.uint8)

    image = Image.fromarray(grayscale, mode="L")
    image = image.resize((2048, 1024), Image.Resampling.BILINEAR)
    image.save(OUTPUT_FILE, optimize=True)

    print("\nHeightmap created:")
    print(OUTPUT_FILE)
    print(f"Output size: {image.width} x {image.height}")


if __name__ == "__main__":
    main()
