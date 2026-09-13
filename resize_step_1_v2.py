"""Step 1 (V2): resize new photographs while preserving EXIF metadata.

Edit INPUT_FOLDER, OUTPUT_FOLDER and FILENAME_PREFIX before running.
The original resize_step_1.py is intentionally left untouched.
"""

from pathlib import Path

from PIL import Image, ImageOps
from tqdm import tqdm


INPUT_FOLDER = Path(r"D:\LR\upload")
OUTPUT_FOLDER = Path(__file__).resolve().parent / "compressed"
FILENAME_PREFIX = "2024_05_1112"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg"}


def output_name(source: Path) -> str:
    prefix = FILENAME_PREFIX.strip("_")
    return f"{prefix}_{source.name}" if prefix else source.name


def resize_photo(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        exif_bytes = image.info.get("exif")

        # Preserve the original rule: small images stay unchanged; larger ones
        # are reduced to half size. The old script checked width twice.
        if image.width <= 1000 and image.height <= 1000:
            new_size = image.size
        else:
            new_size = (max(1, image.width // 2), max(1, image.height // 2))

        resized = image if new_size == image.size else image.resize(new_size, Image.Resampling.LANCZOS)
        save_options = {"format": "JPEG", "quality": 92, "optimize": True}
        if exif_bytes:
            save_options["exif"] = exif_bytes
        resized.convert("RGB").save(destination, **save_options)


def main() -> None:
    if not INPUT_FOLDER.is_dir():
        raise FileNotFoundError(f"Input folder does not exist: {INPUT_FOLDER}")

    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
    sources = sorted(
        path for path in INPUT_FOLDER.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    for source in tqdm(sources, desc="Resizing photographs"):
        resize_photo(source, OUTPUT_FOLDER / output_name(source))

    print(f"Done: {len(sources)} photographs saved to {OUTPUT_FOLDER}")


if __name__ == "__main__":
    main()
