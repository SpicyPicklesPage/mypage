"""Build a clean, privacy-checked GitHub Pages directory.

Run locally after the three gallery update scripts. The destination contains
only browser assets; source scripts, notebooks and Lightroom originals stay out.
"""

from __future__ import annotations

import json
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from PIL import Image, ImageOps
from tqdm import tqdm


SITE_ROOT = Path(__file__).resolve().parent
PUBLISH_ROOT = Path(r"D:\SpicyPickles-Publish")
PHOTO_SOURCE = SITE_ROOT / "photos"
PHOTO_OUTPUT = PUBLISH_ROOT / "photos"
MAX_LONG_EDGE = 1600
JPEG_QUALITY = 82
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

CORE_FILES = {
    "index.html", "pickle-jar-7f3c.html", "photo-v2.html", "photo-v2.css",
    "photo-v2.js", "fireworks.html", "pixel.html", "11.html", "建筑.png",
    "炮弹.png", "content_note.css", "sidebar.js",
}
NOTE_FILES = {
    "结构化思维读书笔记.html", "《金字塔原理》读书笔记.html",
    "《需求预测和库存计划》读书笔记.html", "卓越供应链计划.html",
    "这就是OKR.html", "小米创业思考总结.html",
    "需求计划和库存计划：新产品导入案例.html",
}
SENSITIVE_PATTERNS = {
    "email": re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),
    "old identity": re.compile(r"Pingan\s*YANG|PinganYANG|杨平安|平安阳", re.I),
    "local path": re.compile(r"[A-Z]:[\\/](?:Users|LR|code)[\\/]", re.I),
    "secret marker": re.compile(r"(?:api[_-]?key|password|secret|token)\s*[:=]\s*['\"][^'\"]+", re.I),
    "exact coordinates": re.compile(r"(?:maps\?q=|[?&](?:lat|lon|lng)=)-?\d+\.\d+", re.I),
}


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def copy_site_files() -> None:
    allowed_root_files = CORE_FILES | NOTE_FILES | {".nojekyll"}
    for existing in PUBLISH_ROOT.iterdir():
        if existing.is_file() and existing.name not in allowed_root_files:
            existing.unlink()

    for name in sorted(CORE_FILES | NOTE_FILES):
        source = SITE_ROOT / name
        if not source.exists():
            raise FileNotFoundError(f"缺少网站文件：{source}")
        copy_file(source, PUBLISH_ROOT / name)

    image_assets = SITE_ROOT / "image"
    if image_assets.exists():
        shutil.copytree(image_assets, PUBLISH_ROOT / "image", dirs_exist_ok=True)

    gallery_root = SITE_ROOT / "My_Gallery"
    for source in gallery_root.rglob("*"):
        if source.is_file() and source.name in {"photo-v2.html", "photos_info.json"}:
            copy_file(source, PUBLISH_ROOT / source.relative_to(SITE_ROOT))

    (PUBLISH_ROOT / ".nojekyll").touch()


def compress_photo(source: Path, destination: Path) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        longest = max(image.size)
        if longest > MAX_LONG_EDGE:
            scale = MAX_LONG_EDGE / longest
            image = image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.Resampling.LANCZOS,
            )
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)


def compress_photos() -> tuple[int, int]:
    sources = sorted(
        path for path in PHOTO_SOURCE.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    for source in tqdm(sources, desc="压缩发布照片"):
        destination = PHOTO_OUTPUT / f"{source.stem}.jpg"
        if destination.exists() and destination.stat().st_mtime_ns >= source.stat().st_mtime_ns:
            continue
        compress_photo(source, destination)
    return len(sources), sum(path.stat().st_size for path in PHOTO_OUTPUT.glob("*.jpg"))


def text_files() -> list[Path]:
    suffixes = {".html", ".css", ".js", ".json", ".txt", ".xml"}
    return [path for path in PUBLISH_ROOT.rglob("*") if path.is_file() and path.suffix.lower() in suffixes]


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(self, _tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.references.append(value)


def validate_local_links() -> None:
    missing = []
    for html_file in PUBLISH_ROOT.rglob("*.html"):
        parser = ReferenceParser()
        parser.feed(html_file.read_text(encoding="utf-8"))
        for reference in parser.references:
            if reference.startswith(("#", "//", "data:", "http:", "https:", "mailto:", "tel:", "javascript:")):
                continue
            path_text = unquote(urlsplit(reference).path).replace("\\", "/")
            if not path_text:
                continue
            target = PUBLISH_ROOT / path_text.lstrip("/") if path_text.startswith("/") else html_file.parent / path_text
            if not target.resolve().exists():
                missing.append(f"{html_file.relative_to(PUBLISH_ROOT)} -> {reference}")
    if missing:
        raise FileNotFoundError("发现失效的本地链接：\n" + "\n".join(f"  - {item}" for item in missing[:30]))


def remove_missing_local_images() -> int:
    removed = 0
    image_tag = re.compile(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>', re.I)
    for html_file in PUBLISH_ROOT.rglob("*.html"):
        content = html_file.read_text(encoding="utf-8")

        def replacement(match: re.Match) -> str:
            nonlocal removed
            reference = match.group(1)
            if reference.startswith(("//", "data:", "http:", "https:")):
                return match.group(0)
            path_text = unquote(urlsplit(reference).path).replace("\\", "/")
            target = PUBLISH_ROOT / path_text.lstrip("/") if path_text.startswith("/") else html_file.parent / path_text
            if target.resolve().exists():
                return match.group(0)
            removed += 1
            return "<!-- 缺失的旧本地图片已从发布版移除 -->"

        updated = image_tag.sub(replacement, content)
        if updated != content:
            html_file.write_text(updated, encoding="utf-8")
    return removed


def privacy_findings() -> list[str]:
    findings = []
    for path in text_files():
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in SENSITIVE_PATTERNS.items():
            if pattern.search(content):
                findings.append(f"{label}: {path.relative_to(PUBLISH_ROOT)}")

    for path in PUBLISH_ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        with Image.open(path) as image:
            if image.getexif():
                findings.append(f"EXIF metadata: {path.relative_to(PUBLISH_ROOT)}")
            metadata_text = " ".join(str(value) for key, value in image.info.items() if key != "icc_profile")
            for label, pattern in SENSITIVE_PATTERNS.items():
                if pattern.search(metadata_text):
                    findings.append(f"{label} in image metadata: {path.relative_to(PUBLISH_ROOT)}")
    return findings


def validate_gallery_data() -> None:
    master = PUBLISH_ROOT / "My_Gallery" / "photos_info.json"
    records = json.loads(master.read_text(encoding="utf-8"))
    missing = [record["filename"] for record in records if not (PHOTO_OUTPUT / record["filename"]).exists()]
    if missing:
        raise FileNotFoundError(f"有 {len(missing)} 张图库照片缺失，例如：{missing[:5]}")


def main() -> None:
    PUBLISH_ROOT.mkdir(parents=True, exist_ok=True)
    copy_site_files()
    photo_count, photo_bytes = compress_photos()
    validate_gallery_data()
    removed_images = remove_missing_local_images()
    validate_local_links()

    findings = privacy_findings()
    if findings:
        raise RuntimeError("隐私检查未通过：\n" + "\n".join(f"  - {item}" for item in findings[:30]))

    all_files = [path for path in PUBLISH_ROOT.rglob("*") if path.is_file()]
    total_bytes = sum(path.stat().st_size for path in all_files)
    print(f"完成：{len(all_files)} 个公开文件，{photo_count} 张照片。")
    print(f"照片体积：{photo_bytes / 1024 / 1024:.1f} MB")
    print(f"发布目录总体积：{total_bytes / 1024 / 1024:.1f} MB")
    print(f"已移除失效的旧图片引用：{removed_images} 处")
    print("隐私检查：通过")
    print(f"发布目录：{PUBLISH_ROOT}")


if __name__ == "__main__":
    main()
