"""增量生成分层图库：只扫描一次源目录，只分析新增或变更的照片。"""

from __future__ import annotations

import argparse
import html
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote

import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_SOURCE = Path(r"D:\Lr\My_Gallery")
DEFAULT_OUTPUT = PROJECT_ROOT / "My_Gallery"
DEFAULT_MASTER = PROJECT_ROOT / "master_photos.json"
DEFAULT_MENU = PROJECT_ROOT / "html_menu.txt"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_COORDINATES = (48.8481, 2.3958)
TAG_ORDER = (
    "B&W", "Monochrome", "Muted", "Vivid", "High Key", "Low Key", "Dark",
    "High Contrast", "Soft", "Red", "Orange", "Yellow", "Green", "Cyan",
    "Blue", "Purple", "Magenta", "Cool", "Warm",
)


def file_id(path: Path) -> str:
    """保持旧缓存 ID 格式，已有 master_photos.json 可直接复用。"""
    return f"{os.path.abspath(path)}_{path.stat().st_mtime}"


def load_cache(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"警告：缓存读取失败，将重新建立：{exc}")
        return {}
    items = data if isinstance(data, list) else data.values() if isinstance(data, dict) else []
    cache = {
        str(item["id"]): item
        for item in items
        if isinstance(item, dict) and item.get("id")
    }
    print(f"已加载 {len(cache)} 条照片缓存。")
    return cache


def write_if_changed(path: Path, content: str, dry_run: bool = False) -> bool:
    """内容不变就不刷新文件；需要写时使用原子替换。"""
    try:
        if path.exists() and path.read_text(encoding="utf-8") == content:
            return False
    except (OSError, UnicodeError):
        pass
    if dry_run:
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temporary, path)
    return True


def json_text(data: Any) -> str:
    return json.dumps(data, indent=4, ensure_ascii=False) + "\n"


def scan_library(source: Path) -> dict[Path, list[Path]]:
    """一次扫描建立层级索引；父目录自动包含所有后代目录的照片。"""
    direct: dict[Path, list[Path]] = {}
    for dirpath, dirnames, filenames in os.walk(source):
        dirnames.sort(key=str.casefold)
        filenames.sort(key=str.casefold)
        folder = Path(dirpath)
        relative = folder.relative_to(source)
        direct[relative] = [
            folder / name
            for name in filenames
            if Path(name).suffix.lower() in IMAGE_EXTENSIONS
        ]

    recursive = {folder: [] for folder in direct}
    for folder, images in direct.items():
        ancestor = folder
        while True:
            recursive.setdefault(ancestor, []).extend(images)
            if ancestor == Path("."):
                break
            ancestor = ancestor.parent
    for images in recursive.values():
        images.sort(key=lambda p: str(p.relative_to(source)).casefold())
    return recursive


def get_exif(path: Path) -> dict[str, Any]:
    try:
        with Image.open(path) as image:
            return {TAGS.get(tag, tag): value for tag, value in image.getexif().items()}
    except Exception as exc:
        print(f"  EXIF 读取失败 {path.name}: {exc}")
        return {}


def dms_to_decimal(dms: Any, reference: Any) -> float:
    degrees, minutes, seconds = (float(value) for value in dms)
    decimal = degrees + minutes / 60 + seconds / 3600
    if isinstance(reference, bytes):
        reference = reference.decode(errors="ignore")
    return -decimal if str(reference).upper() in {"S", "W"} else decimal


def get_coordinates(exif: dict[str, Any]) -> tuple[float | None, float | None]:
    try:
        gps = exif.get("GPSInfo")
        if not gps:
            return None, None
        get = gps.get if hasattr(gps, "get") else lambda key: gps[key]
        values = get(2), get(1), get(4), get(3)
        if not all(values):
            return None, None
        return dms_to_decimal(values[0], values[1]), dms_to_decimal(values[2], values[3])
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None, None


def analyze_color(path: Path) -> list[str]:
    """耗时的颜色分析只会对新照片或已修改照片执行。"""
    tags: set[str] = set()
    try:
        with Image.open(path) as image:
            image.thumbnail((100, 100))
            hsv = np.asarray(image.convert("RGB").convert("HSV"))
        hue, saturation, value = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        avg_s, avg_v, std_v = map(float, (np.mean(saturation), np.mean(value), np.std(value)))
        if avg_s < 20:
            tags.update(("B&W", "Monochrome"))
        else:
            if avg_s < 60:
                tags.add("Muted")
            elif avg_s > 150:
                tags.add("Vivid")
            if avg_v > 180:
                tags.add("High Key")
            elif avg_v < 80:
                tags.update(("Low Key", "Dark"))
            if std_v > 60:
                tags.add("High Contrast")
            elif std_v < 30:
                tags.add("Soft")

            valid = (saturation > 40) & (value > 40)
            count = int(np.sum(valid))
            if count:
                histogram, _ = np.histogram(
                    hue[valid], bins=[0, 20, 40, 70, 105, 135, 175, 215, 235, 256]
                )
                counts = dict(zip(
                    ("Orange", "Yellow", "Green", "Cyan", "Blue", "Purple", "Magenta"),
                    map(int, histogram[1:8]),
                ))
                counts["Red"] = int(histogram[0] + histogram[8])
                primary = max(counts, key=counts.get)
                if counts[primary] / count > 0.25:
                    tags.add(primary)
                    tags.add("Cool" if primary in {"Blue", "Cyan", "Green", "Purple"} else "Warm")
    except Exception as exc:
        print(f"  颜色分析失败 {path.name}: {exc}")
    return [tag for tag in TAG_ORDER if tag in tags]


def exif_text(exif: dict[str, Any], key: str, default: str = "") -> str:
    value = exif.get(key, default)
    return str(value) if value not in (None, "") else default


def aperture_text(exif: dict[str, Any]) -> str:
    try:
        if exif.get("FNumber"):
            return f"f/{float(exif['FNumber']):g}"
        if exif.get("ApertureValue") is not None:
            return f"f/{2 ** (float(exif['ApertureValue']) / 2):.1f}"
    except (TypeError, ValueError, ZeroDivisionError):
        pass
    return ""


def analyze_photo(path: Path, current_id: str, previous: dict[str, Any] | None) -> dict[str, Any]:
    print(f"  分析：{path.name}")
    width = height = 0
    try:
        with Image.open(path) as image:
            width, height = image.size
    except Exception as exc:
        print(f"  图片读取失败 {path.name}: {exc}")
    exif = get_exif(path)
    latitude, longitude = get_coordinates(exif)
    latitude = DEFAULT_COORDINATES[0] if latitude is None else latitude
    longitude = DEFAULT_COORDINATES[1] if longitude is None else longitude
    return {
        "id": current_id,
        "filename": path.name,
        "width": width,
        "height": height,
        "title": path.name,
        "tags": analyze_color(path),
        "Link": f"https://www.google.com/maps?q={latitude},{longitude}",
        "CameraModel": f"{exif_text(exif, 'Model', 'Unknown Camera')}\n",
        "ISO": f"{exif_text(exif, 'ISOSpeedRatings')}\n",
        "FocalLength": f"{exif_text(exif, 'FocalLength')}\n",
        "ExposureBiasValue": f"{exif_text(exif, 'ExposureBiasValue')}\n",
        "Aperture": f"{aperture_text(exif)}\n",
        "ExposureTime": f"{exif_text(exif, 'ExposureTime')}\n",
        "ai_analysis": previous.get("ai_analysis") if previous else None,
    }


def index_html(images: list[Path]) -> str:
    tags = "\n".join(
        f'        <img src="{html.escape(p.name, quote=True)}" alt="{html.escape(p.name, quote=True)}">'
        for p in images
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Photo Gallery</title>
    <style>
        body {{ margin: 0; display: flex; flex-direction: column; align-items: center; }}
        .gallery {{ display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 20px; }}
        .gallery img {{ max-width: 200px; border: 1px solid #ccc; padding: 5px; background: #f8f8f8; }}
    </style>
</head>
<body>
    <h1>Photo Gallery</h1>
    <div class="gallery">
{tags}
    </div>
</body>
</html>
"""


def photo_html(images: list[Path], output_folder: Path, level: int, menu: str) -> str:
    location = html.escape(output_folder.name)
    prefix = "../" * level
    first = quote(images[0].name)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="{prefix}img.css">
    <link rel="stylesheet" href="{prefix}st.css">
    <link rel="stylesheet" href="{prefix}menus.css">
    <link rel="stylesheet" href="{prefix}stylesheet.css">
    <title>{location} - Photography Portfolio</title>
</head>
<body>
{menu}
    <div class="navbar"></div>
    <div class="image-info"><a href="https://www.google.fr/maps" target="_blank" rel="noopener">点击查看更多</a></div>
    <div class="banner" style="background-image: url('{prefix}photos/{first}');">
        <h1>Welcome to {location}</h1>
    </div>
    <div id="myModal" class="modal">
        <span class="close">&times;</span><img class="modal-content" id="img01" alt=""><div id="caption"></div>
    </div>
    <div class="gallery" id="gallery"></div>
    <div id="loading"><p>Loading more photos...</p></div>
    <footer></footer>
    <script>const photosJsonUrl = './photos_info.json';</script>
    <script src="{prefix}img_random.js"></script>
</body>
</html>
"""


def build_gallery(
    source: Path, output: Path, master: Path, menu_path: Path,
    force: bool = False, dry_run: bool = False,
) -> int:
    source, output, master = source.resolve(), output.resolve(), master.resolve()
    if not source.is_dir():
        print(f"错误：源目录不存在：{source}")
        return 2

    old_cache = load_cache(master)
    folders = scan_library(source)
    all_images = folders.get(Path("."), [])
    print(f"找到 {len(all_images)} 张照片、{len(folders)} 个目录。")

    records: dict[Path, dict[str, Any]] = {}
    new_cache: dict[str, dict[str, Any]] = {}
    analyzed = cache_hits = 0
    for image in all_images:
        current_id = file_id(image)
        cached = old_cache.get(current_id)
        if cached is not None and not force:
            record = cached
            cache_hits += 1
        else:
            record = analyze_photo(image, current_id, cached)
            analyzed += 1
        records[image] = record
        new_cache[current_id] = record

    try:
        menu = menu_path.read_text(encoding="utf-8") if menu_path.exists() else ""
    except (OSError, UnicodeError) as exc:
        print(f"警告：菜单读取失败：{exc}")
        menu = ""

    written = unchanged = processed = 0
    order = sorted(folders, key=lambda p: (len(p.parts), str(p).casefold()))
    for relative in order:
        images = folders[relative]
        if not images:
            continue
        processed += 1
        destination = output if relative == Path(".") else output / relative
        folder_records = []
        for image in images:
            record = records[image].copy()
            record["Location"] = destination.name
            folder_records.append(record)
        files = {
            destination / "photos_info.json": json_text(folder_records),
            destination / "index.html": index_html(images),
            destination / "photo.html": photo_html(images, destination, len(relative.parts) + 1, menu),
        }
        for path, content in files.items():
            if write_if_changed(path, content, dry_run):
                written += 1
            else:
                unchanged += 1

    cache_list = [new_cache[key] for key in sorted(new_cache, key=str.casefold)]
    if write_if_changed(master, json_text(cache_list), dry_run):
        written += 1
    else:
        unchanged += 1

    verb = "将写入" if dry_run else "写入"
    print(
        f"完成：处理 {processed} 个图库；缓存命中 {cache_hits} 张，新分析 {analyzed} 张；"
        f"{verb} {written} 个文件，跳过 {unchanged} 个未变化文件。"
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="原始图库目录")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="网站图库输出目录")
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER, help="照片缓存 JSON")
    parser.add_argument("--menu", type=Path, default=DEFAULT_MENU, help="菜单 HTML 文件")
    parser.add_argument("--force", action="store_true", help="忽略缓存，重新分析全部照片")
    parser.add_argument("--dry-run", action="store_true", help="只报告变化，不写入文件")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return build_gallery(args.source, args.output, args.master, args.menu, args.force, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
