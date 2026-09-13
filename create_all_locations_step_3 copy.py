"""Step 3: regenerate JSON data and SpicyPickles photo pages.

Run after resize_step_1.py and create_html_cate_step_2.py. This script writes
only the current photo-v2 layout; it never recreates the retired portfolio.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from html import escape
from pathlib import Path

import numpy as np
from PIL import ExifTags, Image

from create_html_cate_step_2 import LOCATION_MAPPING


SOURCE_ROOT = Path(r"D:\LR\My_Gallery")
SITE_ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = SITE_ROOT / "My_Gallery"
MASTER_JSON_PATH = SITE_ROOT / "master_photos.json"
MENU_FRAGMENT_PATH = SITE_ROOT / "archive_menu.html"
ROOT_GALLERY_PAGE = SITE_ROOT / "photo-v2.html"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

CACHE_BY_ID: dict[str, dict] = {}
CACHE_BY_FILENAME: dict[str, dict] = {}
ACTIVE_RECORDS: dict[str, dict] = {}


def image_files(folder: Path, recursive: bool = True) -> list[Path]:
    iterator = folder.rglob("*") if recursive else folder.iterdir()
    return sorted(
        path for path in iterator
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def assert_unique_filenames(images: list[Path]) -> None:
    grouped: dict[str, list[Path]] = {}
    for image in images:
        grouped.setdefault(image.name.casefold(), []).append(image)
    conflicts = [paths for paths in grouped.values() if len(paths) > 1]
    if conflicts:
        details = "\n".join("  - " + " | ".join(map(str, paths)) for paths in conflicts[:10])
        raise ValueError("发现同名照片；公共图库要求文件名唯一：\n" + details)


def public_id(path: Path) -> str:
    relative = path.relative_to(SOURCE_ROOT).as_posix()
    signature = f"{relative}|{path.stat().st_size}|{path.stat().st_mtime_ns}"
    return hashlib.sha256(signature.encode("utf-8")).hexdigest()[:24]


def load_cache() -> None:
    if not MASTER_JSON_PATH.exists():
        return
    try:
        records = json.loads(MASTER_JSON_PATH.read_text(encoding="utf-8"))
        for record in records:
            identifier = str(record.get("id", ""))
            filename = str(record.get("filename", ""))
            if identifier:
                CACHE_BY_ID[identifier] = record
            if filename:
                CACHE_BY_FILENAME[filename.casefold()] = record
        print(f"已读取缓存：{len(records)} 张")
    except (OSError, json.JSONDecodeError, TypeError) as error:
        print(f"缓存读取失败，将重新分析：{error}")


def save_cache() -> None:
    temporary = MASTER_JSON_PATH.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(list(ACTIVE_RECORDS.values()), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    os.replace(temporary, MASTER_JSON_PATH)
    print(f"主照片数据已更新：{len(ACTIVE_RECORDS)} 张")


def exif_data(path: Path) -> dict:
    result = {}
    try:
        with Image.open(path) as image:
            raw = image.getexif()
            for tag, value in raw.items():
                result[ExifTags.TAGS.get(tag, tag)] = value
    except OSError as error:
        print(f"  EXIF 读取失败 {path.name}: {error}")
    return result


def safe_exif(exif: dict, key: str, default: str = "") -> str:
    value = exif.get(key, default)
    return str(value) if value not in (None, "") else default


def color_tags(path: Path) -> list[str]:
    tags: set[str] = set()
    try:
        with Image.open(path) as source:
            pixels = np.asarray(source.convert("RGB").resize((100, 100)).convert("HSV"))
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
        print(f"  色彩分析失败 {path.name}: {error}")
    return sorted(tags)


def analyze_photo(path: Path, identifier: str) -> dict:
    try:
        with Image.open(path) as image:
            width, height = image.size
    except OSError:
        width, height = 0, 0
    exif = exif_data(path)
    return {
        "id": identifier,
        "filename": path.with_suffix(".jpg").name if path.suffix.lower() == ".jpeg" else path.name,
        "width": width,
        "height": height,
        "title": path.stem,
        "tags": color_tags(path),
        # Exact GPS and source paths are deliberately excluded from public JSON.
        "Link": "",
        "CameraModel": safe_exif(exif, "Model", "Unknown Camera"),
        "ISO": safe_exif(exif, "ISOSpeedRatings"),
        "FocalLength": safe_exif(exif, "FocalLength"),
        "ExposureBiasValue": safe_exif(exif, "ExposureBiasValue"),
        "Aperture": f'f/{safe_exif(exif, "FNumber")}',
        "ExposureTime": safe_exif(exif, "ExposureTime"),
        "ai_analysis": None,
    }


def process_photo(path: Path) -> dict:
    identifier = public_id(path)
    cached = CACHE_BY_ID.get(identifier)

    # One-time migration from the old cache, whose IDs exposed absolute paths.
    if cached is None:
        legacy = CACHE_BY_FILENAME.get(path.name.casefold())
        if legacy and int(legacy.get("width", -1)) > 0 and int(legacy.get("height", -1)) > 0:
            cached = legacy.copy()

    if cached is None:
        print(f"  分析新照片：{path.name}")
        record = analyze_photo(path, identifier)
    else:
        record = cached.copy()
        record["id"] = identifier
        record["filename"] = path.with_suffix(".jpg").name if path.suffix.lower() == ".jpeg" else path.name
        record["title"] = path.stem
        record["Link"] = ""

    ACTIVE_RECORDS[identifier] = record
    CACHE_BY_ID[identifier] = record
    return record


def location_label(folder: Path) -> str:
    return LOCATION_MAPPING.get(folder.name, folder.name.replace("_", " "))


def output_folder_for(source_folder: Path) -> Path:
    return OUTPUT_ROOT / source_folder.relative_to(SOURCE_ROOT)


def relative_asset(output_folder: Path, filename: str) -> str:
    prefix = os.path.relpath(SITE_ROOT, output_folder).replace("\\", "/")
    return f"{prefix}/{filename}" if prefix != "." else filename


def menu_fragment() -> str:
    if not MENU_FRAGMENT_PATH.exists():
        raise FileNotFoundError("缺少 archive_menu.html，请先运行 create_html_cate_step_2.py")
    return MENU_FRAGMENT_PATH.read_text(encoding="utf-8")


def write_json(source_folder: Path, output_folder: Path, images: list[Path]) -> list[dict]:
    records = []
    for image in images:
        record = process_photo(image).copy()
        record["Location"] = location_label(source_folder)
        records.append(record)
    output_folder.mkdir(parents=True, exist_ok=True)
    (output_folder / "photos_info.json").write_text(
        json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return records


def write_photo_page(source_folder: Path, output_folder: Path, records: list[dict]) -> None:
    if not records:
        return
    location = location_label(source_folder) if source_folder != SOURCE_ROOT else "全部地点"
    english = source_folder.name.replace("_", " ") if source_folder != SOURCE_ROOT else "ALL PLACES"
    css_path = relative_asset(output_folder, "photo-v2.css")
    js_path = relative_asset(output_folder, "photo-v2.js")
    page = f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#181a1b">
  <meta name="description" content="SpicyPickles 的 {escape(location)} 摄影档案。">
  <link rel="stylesheet" href="{escape(css_path)}">
  <title>{escape(location)} — SpicyPickles 摄影档案</title>
</head>
<body>
  <header class="site-rail">
    <a class="wordmark" href="/" aria-label="返回首页"><span>SpicyPickles</span><small>PHOTOGRAPHY</small></a>
    <button class="menu-button" id="menuButton" type="button" aria-expanded="false" aria-controls="archiveMenu"><span class="menu-button__mark" aria-hidden="true"></span><span>地点索引</span></button>
    <p class="rail-note">城市 / 自然<br>旁观者档案</p>
  </header>
  <aside class="archive-menu" id="archiveMenu" aria-hidden="true" inert>
    <div class="archive-menu__head"><p>ARCHIVE / 地点索引</p><button id="menuClose" type="button" aria-label="关闭地点索引">关闭</button></div>
    {menu_fragment()}
  </aside>
  <div class="menu-scrim" id="menuScrim" aria-hidden="true"></div>
  <main id="top">
    <section class="opening-frame" id="openingFrame" aria-labelledby="pageTitle">
      <div class="opening-frame__image" aria-hidden="true"></div><div class="opening-frame__shade" aria-hidden="true"></div>
      <div class="opening-frame__copy"><p class="eyebrow">LOCATION / {escape(english)}</p><h1 id="pageTitle">{escape(location)}</h1><p class="statement">置身其外，看见其间。</p></div>
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


def update_root_menu() -> None:
    if not ROOT_GALLERY_PAGE.exists():
        return
    content = ROOT_GALLERY_PAGE.read_text(encoding="utf-8")
    updated, replacements = re.subn(
        r'<nav class="place-list"[^>]*>.*?</nav>',
        menu_fragment(),
        content,
        count=1,
        flags=re.DOTALL,
    )
    if replacements != 1:
        raise ValueError("无法在 photo-v2.html 中定位地点菜单")
    ROOT_GALLERY_PAGE.write_text(updated, encoding="utf-8")


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"图库目录不存在：{SOURCE_ROOT}")

    all_images = image_files(SOURCE_ROOT)
    assert_unique_filenames(all_images)
    load_cache()

    folders = [SOURCE_ROOT] + sorted(path for path in SOURCE_ROOT.rglob("*") if path.is_dir())
    for source_folder in folders:
        images = image_files(source_folder)
        if not images:
            continue
        output_folder = output_folder_for(source_folder)
        print(f"处理 {source_folder.relative_to(SOURCE_ROOT)}：{len(images)} 张")
        records = write_json(source_folder, output_folder, images)
        write_photo_page(source_folder, output_folder, records)

    save_cache()
    update_root_menu()
    print("完成：所有地点页面、索引与主图库数据均已更新。")


if __name__ == "__main__":
    main()
