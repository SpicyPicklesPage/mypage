"""Step 1: prepare privacy-safe photographs for the public website.

Put new photographs anywhere below D:\\LR\\My_Gallery, then run this file.
Images are flattened into the site's ``photos`` directory because every gallery
page shares the same public image pool. Source photographs are never modified.
"""

from pathlib import Path

from PIL import Image, ImageOps
from tqdm import tqdm


SOURCE_ROOT = Path(r"D:\LR\My_Gallery")
SITE_ROOT = Path(__file__).resolve().parent
OUTPUT_FOLDER = SITE_ROOT / "photos"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_LONG_EDGE = 2400
JPEG_QUALITY = 90


def source_images() -> list[Path]:
    images = sorted(
        path for path in SOURCE_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    duplicates: dict[str, list[Path]] = {}
    for image in images:
        duplicates.setdefault(image.name.casefold(), []).append(image)
    conflicts = [paths for paths in duplicates.values() if len(paths) > 1]
    if conflicts:
        examples = "\n".join("  - " + " | ".join(map(str, paths)) for paths in conflicts[:10])
        raise ValueError(
            "发现同名照片，无法安全放入公共 photos 文件夹。请先重命名：\n" + examples
        )
    return images


def destination_for(source: Path) -> Path:
    suffix = ".jpg" if source.suffix.lower() in {".jpg", ".jpeg"} else source.suffix.lower()
    return OUTPUT_FOLDER / f"{source.stem}{suffix}"


def needs_update(source: Path, destination: Path) -> bool:
    return not destination.exists() or source.stat().st_mtime_ns > destination.stat().st_mtime_ns


def publish_photo(source: Path, destination: Path) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        longest = max(image.size)
        if longest > MAX_LONG_EDGE:
            scale = MAX_LONG_EDGE / longest
            image = image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.Resampling.LANCZOS,
            )

        # Intentionally omit EXIF: published files must not expose GPS, author,
        # device serial numbers, or other private camera metadata.
        if destination.suffix == ".jpg":
            image.save(destination, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        elif destination.suffix == ".png":
            image.save(destination, "PNG", optimize=True)
        else:
            image.save(destination, "WEBP", quality=JPEG_QUALITY, method=6)


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"图库目录不存在：{SOURCE_ROOT}")

    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
    images = source_images()
    pending = [(source, destination_for(source)) for source in images]
    pending = [(source, destination) for source, destination in pending if needs_update(source, destination)]

    for source, destination in tqdm(pending, desc="同步网站照片"):
        publish_photo(source, destination)

    print(f"完成：图库共 {len(images)} 张，本次更新 {len(pending)} 张。")
    print(f"公开图片目录：{OUTPUT_FOLDER}")


if __name__ == "__main__":
    main()
