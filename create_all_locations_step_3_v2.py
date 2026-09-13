"""Step 3 (V2): generate tagged JSON and photo-v2 pages for all locations.

This copy preserves the original incremental cache idea while generating the
new portfolio page format. It does not alter the three original scripts.
"""

from __future__ import annotations

import json
import os
from html import escape
from pathlib import Path

import numpy as np
from PIL import ExifTags, Image


SOURCE_ROOT = Path(r"D:\LR\My_Gallery")
SITE_ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = SITE_ROOT / "My_Gallery"
MASTER_JSON_PATH = SITE_ROOT / "master_photos.json"
MENU_FRAGMENT_PATH = SITE_ROOT / "archive_menu_v2.html"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

PHOTO_CACHE: dict[str, dict] = {}


def list_image_files(folder: Path) -> list[Path]:
    return sorted(
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def file_id(path: Path) -> str:
    return f"{path.resolve()}_{path.stat().st_mtime}"


def load_master_data() -> None:
    if not MASTER_JSON_PATH.exists():
        return
    try:
        data = json.loads(MASTER_JSON_PATH.read_text(encoding="utf-8"))
        PHOTO_CACHE.update({item["id"]: item for item in data if item.get("id")})
        print(f"Loaded cache: {len(PHOTO_CACHE)} photographs")
    except (OSError, json.JSONDecodeError, TypeError) as error:
        print(f"Warning: cache could not be read: {error}")


def save_master_data() -> None:
    temporary = MASTER_JSON_PATH.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(list(PHOTO_CACHE.values()), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    os.replace(temporary, MASTER_JSON_PATH)
    print(f"Saved cache: {len(PHOTO_CACHE)} photographs")


def exif_data(path: Path) -> dict:
    result = {}
    try:
        with Image.open(path) as image:
            raw = image.getexif()
            for tag, value in raw.items():
                result[ExifTags.TAGS.get(tag, tag)] = value
    except OSError as error:
        print(f"  EXIF warning for {path.name}: {error}")
    return result


def decimal_from_dms(dms, reference: str) -> float:
    degrees, minutes, seconds = (float(value) for value in dms)
    decimal = degrees + minutes / 60 + seconds / 3600
    return -decimal if reference in {"S", "W"} else decimal


def gps_coordinates(exif: dict) -> tuple[float | None, float | None]:
    try:
        gps = exif.get("GPSInfo")
        if not gps:
            return None, None
        latitude = decimal_from_dms(gps[2], gps[1])
        longitude = decimal_from_dms(gps[4], gps[3])
        return latitude, longitude
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None, None


def analyze_color_theme(path: Path) -> list[str]:
    tags: set[str] = set()
    try:
        with Image.open(path) as source:
            sample = source.convert("RGB").resize((100, 100)).convert("HSV")
        pixels = np.asarray(sample)
        hue, saturation, value = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
        average_saturation = float(np.mean(saturation))
        average_value = float(np.mean(value))
        value_deviation = float(np.std(value))

        if average_saturation < 20:
            return ["B&W", "Monochrome"]
        if average_saturation < 60:
            tags.add("Muted")
        elif average_saturation > 150:
            tags.add("Vivid")

        if average_value > 180:
            tags.add("High Key")
        elif average_value < 80:
            tags.update(("Low Key", "Dark"))

        if value_deviation > 60:
            tags.add("High Contrast")
        elif value_deviation < 30:
            tags.add("Soft")

        valid = (saturation > 40) & (value > 40)
        valid_count = int(np.sum(valid))
        if valid_count:
            histogram, _ = np.histogram(
                hue[valid], bins=[0, 20, 40, 70, 105, 135, 175, 215, 235, 256]
            )
            counts = {
                "Red": int(histogram[0] + histogram[8]), "Orange": int(histogram[1]),
                "Yellow": int(histogram[2]), "Green": int(histogram[3]),
                "Cyan": int(histogram[4]), "Blue": int(histogram[5]),
                "Purple": int(histogram[6]), "Magenta": int(histogram[7]),
            }
            primary = max(counts, key=counts.get)
            if counts[primary] / valid_count > 0.25:
                tags.add(primary)
                tags.add("Cool" if primary in {"Blue", "Cyan", "Green", "Purple"} else "Warm")
    except OSError as error:
        print(f"  Color warning for {path.name}: {error}")
    return sorted(tags)


def safe_exif(exif: dict, key: str, default: str = "") -> str:
    value = exif.get(key, default)
    return str(value) if value not in (None, "") else default


def process_photo(path: Path) -> dict:
    identifier = file_id(path)
    if identifier in PHOTO_CACHE:
        return PHOTO_CACHE[identifier]

    print(f"  Analyzing: {path.name}")
    try:
        with Image.open(path) as image:
            width, height = image.size
    except OSError:
        width, height = 0, 0

    exif = exif_data(path)
    latitude, longitude = gps_coordinates(exif)
    latitude = 48.8481 if latitude is None else latitude
    longitude = 2.3958 if longitude is None else longitude

    data = {
        "id": identifier,
        "filename": path.name,
        "width": width,
        "height": height,
        "title": path.name,
        "tags": analyze_color_theme(path),
        "Link": f"https://www.google.com/maps?q={latitude},{longitude}",
        "CameraModel": safe_exif(exif, "Model", "Unknown Camera"),
        "ISO": safe_exif(exif, "ISOSpeedRatings"),
        "FocalLength": safe_exif(exif, "FocalLength"),
        "ExposureBiasValue": safe_exif(exif, "ExposureBiasValue"),
        "Aperture": f'f/{safe_exif(exif, "FNumber")}',
        "ExposureTime": safe_exif(exif, "ExposureTime"),
        "ai_analysis": None,
    }
    PHOTO_CACHE[identifier] = data
    return data


def write_location_json(source_folder: Path, output_folder: Path, images: list[Path]) -> list[dict]:
    location = source_folder.name
    records = []
    for image in images:
        record = process_photo(image).copy()
        record["Location"] = location
        records.append(record)

    output_folder.mkdir(parents=True, exist_ok=True)
    destination = output_folder / "photos_info.json"
    destination.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    return records


def relative_asset(output_folder: Path, filename: str) -> str:
    prefix = os.path.relpath(SITE_ROOT, output_folder).replace("\\", "/")
    return f"{prefix}/{filename}" if prefix != "." else filename


def menu_fragment() -> str:
    if MENU_FRAGMENT_PATH.exists():
        return MENU_FRAGMENT_PATH.read_text(encoding="utf-8")
    return '<nav class="place-list"><a href="/My_Gallery/photo-v2.html">全部地点</a></nav>'


def write_photo_page(source_folder: Path, output_folder: Path, records: list[dict]) -> None:
    if not records:
        return
    location = source_folder.name.replace("_", " ")
    css_path = relative_asset(output_folder, "photo-v2.css")
    js_path = relative_asset(output_folder, "photo-v2.js")
    menu = menu_fragment()
    page = f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0b0a">
  <link rel="stylesheet" href="{escape(css_path)}">
  <title>{escape(location)} — SpicyPickles 摄影档案</title>
</head>
<body>
  <header class="site-rail">
    <a class="wordmark" href="#top" aria-label="回到顶部"><span>SpicyPickles</span><small>PHOTOGRAPHY</small></a>
    <button class="menu-button" id="menuButton" type="button" aria-expanded="false" aria-controls="archiveMenu"><span class="menu-button__mark" aria-hidden="true"></span><span>地点索引</span></button>
    <p class="rail-note">城市 / 自然<br>旁观者档案</p>
  </header>
  <aside class="archive-menu" id="archiveMenu" aria-hidden="true" inert>
    <div class="archive-menu__head"><p>ARCHIVE / 地点索引</p><button id="menuClose" type="button" aria-label="关闭地点索引">关闭</button></div>
    {menu}
  </aside>
  <div class="menu-scrim" id="menuScrim" aria-hidden="true"></div>
  <main id="top">
    <section class="opening-frame" id="openingFrame" aria-labelledby="pageTitle">
      <div class="opening-frame__image" aria-hidden="true"></div><div class="opening-frame__shade" aria-hidden="true"></div>
      <div class="opening-frame__copy"><p class="eyebrow">LOCATION / 地点</p><h1 id="pageTitle">{escape(location)}</h1><p class="statement">置身其外，看见其间。</p></div>
      <p class="opening-frame__index"><span id="photoCount">—</span> FRAGMENTS</p>
      <a class="opening-frame__down" href="#galleryStart">进入影像 <span aria-hidden="true">↓</span></a>
    </section>
    <section class="gallery-section" id="galleryStart" aria-label="{escape(location)}摄影作品">
      <header class="gallery-head"><p>OBSERVATIONS</p><p id="sequenceLabel">正在整理随机序列…</p></header>
      <div class="gallery" id="gallery"></div>
      <div class="loading" id="loading" role="status" aria-live="polite"><span class="loading__line"></span><span id="loadingText">正在显影…</span></div>
    </section>
  </main>
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="照片预览" aria-hidden="true" inert>
    <button class="lightbox__close" id="lightboxClose" type="button" aria-label="关闭预览">关闭</button>
    <button class="lightbox__nav lightbox__nav--prev" id="lightboxPrev" type="button" aria-label="上一张">←</button>
    <figure class="lightbox__figure"><img id="lightboxImage" alt=""><figcaption><div><p class="lightbox__title" id="lightboxTitle"></p><p class="lightbox__meta" id="lightboxMeta"></p></div><p class="lightbox__count" id="lightboxCount"></p></figcaption></figure>
    <button class="lightbox__nav lightbox__nav--next" id="lightboxNext" type="button" aria-label="下一张">→</button>
  </div>
  <script>window.PHOTO_V2_CONFIG={{dataUrl:'./photos_info.json',photoBase:'/photos/'}};</script>
  <script src="{escape(js_path)}" defer></script>
</body>
</html>'''
    (output_folder / "photo-v2.html").write_text(page, encoding="utf-8")


def output_folder_for(source_folder: Path) -> Path:
    relative = source_folder.relative_to(SOURCE_ROOT)
    return OUTPUT_ROOT / relative


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"Gallery root does not exist: {SOURCE_ROOT}")

    load_master_data()
    try:
        folders = [SOURCE_ROOT] + sorted(path for path in SOURCE_ROOT.rglob("*") if path.is_dir())
        for source_folder in folders:
            images = list_image_files(source_folder)
            if not images:
                continue
            output_folder = output_folder_for(source_folder)
            print(f"Processing {source_folder.relative_to(SOURCE_ROOT)}: {len(images)} photographs")
            records = write_location_json(source_folder, output_folder, images)
            write_photo_page(source_folder, output_folder, records)
    finally:
        save_master_data()

    print("All V2 location pages are ready.")


if __name__ == "__main__":
    main()
