"""Convert a TIFF roll to browser JPEGs and existing-gallery-style JSON.

Usage: python prepare_film_roll.py SOURCE_FOLDER SITE_ROOT
Originals are opened read-only. Exclusions and upright rotations are applied
only to the web copies, based on the reviewed scans.
"""
from __future__ import annotations

import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageCms

TARGET_BYTES = 2_000_000
MAX_LONG_EDGE = 5200
EXCLUDED_STEMS = {"000159800001"}
# Positive angles are counterclockwise, as used by Pillow.
ROTATIONS = {
    4: 90, 6: -90, 7: -90, 8: -90, 9: 90, 10: 90, 12: 90,
    13: 90, 14: 90, 16: 90, 17: 90, 18: 90, 26: 90, 27: 90,
    28: 90, 29: 90, 31: 90, 33: 90,
}


def encode(image, quality):
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality, progressive=True)
    return buffer.getvalue()


def convert(source, output):
    source_stat = source.stat()
    with Image.open(source) as opened:
        if opened.info.get("icc_profile"):
            image = ImageCms.profileToProfile(
                opened,
                ImageCms.ImageCmsProfile(io.BytesIO(opened.info["icc_profile"])),
                ImageCms.createProfile("sRGB"),
                outputMode="RGB",
            )
        else:
            image = opened.convert("RGB")
        rotation = ROTATIONS.get(int(source.stem[-4:]), 0)
        if rotation:
            image = image.rotate(rotation, expand=True)
        image.thumbnail((MAX_LONG_EDGE, MAX_LONG_EDGE), Image.Resampling.LANCZOS)

    while True:
        smallest = encode(image, 82)
        if len(smallest) <= TARGET_BYTES:
            break
        scale = min(.95, (TARGET_BYTES / len(smallest)) ** .5 * .97)
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    low, high, best = 82, 98, smallest
    while low <= high:
        quality = (low + high) // 2
        candidate = encode(image, quality)
        if len(candidate) <= TARGET_BYTES:
            best, low = candidate, quality + 1
        else:
            high = quality - 1

    filename = source.stem + ".jpg"
    (output / "full" / filename).write_bytes(best)
    thumb = image.copy()
    thumb.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
    thumb.save(output / "thumbs" / filename, "JPEG", quality=85, progressive=True)

    # These scans carry no camera/GPS fields; do not fabricate them.
    sample = image.resize((80, 80)).convert("HSV")
    saturation = sum(pixel[1] for pixel in sample.getdata()) / 6400
    tags = ["B&W", "Monochrome"] if saturation < 20 else ["Film"]
    record = {
        "id": "film-" + source.stem,
        "filename": filename,
        "thumbnail": "thumbs/" + filename,
        "width": image.width,
        "height": image.height,
        "title": "胶片手记 / " + source.stem[-4:],
        "frame": int(source.stem[-4:]),
        "rotation_degrees": rotation,
        "tags": tags,
        "Location": "00015980",
        "Link": "",
        "CameraModel": "",
        "ISO": "",
        "FocalLength": "",
        "Aperture": "",
        "ExposureTime": "",
        "bytes": len(best),
        "ai_analysis": None,
    }
    after = source.stat()
    assert (source_stat.st_size, source_stat.st_mtime_ns) == (after.st_size, after.st_mtime_ns)
    print(f"{filename}: {len(best):,} bytes; {image.width} x {image.height}", flush=True)
    return record


def main():
    source, site = map(Path, sys.argv[1:3])
    files = sorted(p for p in source.iterdir()
                   if p.suffix.lower() in {".tif", ".tiff"} and p.stem not in EXCLUDED_STEMS)
    if not files:
        raise RuntimeError("No TIFF files found")
    output = site / "photos" / "film-00015980"
    for folder in (output / "full", output / "thumbs"):
        folder.mkdir(parents=True, exist_ok=True)
        for stem in EXCLUDED_STEMS:
            (folder / (stem + ".jpg")).unlink(missing_ok=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(lambda p: convert(p, output), files))
    manifest = json.dumps(records, ensure_ascii=False, indent=2)
    (output / "photos_info.json").write_text(manifest + "\n", encoding="utf-8")
    (output / "photos_info.js").write_text(
        "window.FILM_ROLL_PHOTOS = " + manifest + ";\n", encoding="utf-8"
    )
    print(json.dumps({"count": len(records), "min_bytes": min(r["bytes"] for r in records),
                      "max_bytes": max(r["bytes"] for r in records),
                      "total_bytes": sum(r["bytes"] for r in records)}), flush=True)


if __name__ == "__main__":
    main()
