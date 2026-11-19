"""Build browser JPEGs for a configured roll without modifying the originals.

Usage: python prepare_film_album.py ROLL_ID SOURCE_FOLDER [SITE_ROOT]
The order and reviewed rotations live in film_imports.json, next to this file.
"""
from __future__ import annotations

import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageCms

TARGET_BYTES = 2_000_000


def encode(image, quality):
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality, progressive=True)
    return buffer.getvalue()


def convert(item, source, output, roll_id):
    path = source / item["name"]
    before = path.stat()
    with Image.open(path) as opened:
        if opened.info.get("icc_profile"):
            image = ImageCms.profileToProfile(opened,
                ImageCms.ImageCmsProfile(io.BytesIO(opened.info["icc_profile"])),
                ImageCms.createProfile("sRGB"), outputMode="RGB")
        else:
            image = opened.convert("RGB")
        if item["rotation"]:
            image = image.rotate(item["rotation"], expand=True)
        image.thumbnail((5200, 5200), Image.Resampling.LANCZOS)
    while True:
        smallest = encode(image, 82)
        if len(smallest) <= TARGET_BYTES:
            break
        scale = min(.95, (TARGET_BYTES / len(smallest)) ** .5 * .97)
        image = image.resize((max(1, round(image.width * scale)),
                              max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
    low, high, best = 82, 98, smallest
    while low <= high:
        quality = (low + high) // 2
        candidate = encode(image, quality)
        if len(candidate) <= TARGET_BYTES:
            best, low = candidate, quality + 1
        else:
            high = quality - 1
    name = Path(item["name"]).stem + ".jpg"
    (output / "full" / name).write_bytes(best)
    thumb = image.copy()
    thumb.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
    thumb.save(output / "thumbs" / name, "JPEG", quality=85, progressive=True)
    after = path.stat()
    assert (before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns)
    print(f'{item["sequence"]:02d}: {len(best):,} bytes; {image.width} x {image.height}', flush=True)
    return {"id": roll_id + "-" + Path(item["name"]).stem,
        "filename": name, "thumbnail": "thumbs/" + name,
        "width": image.width, "height": image.height,
        "title": "Kodak Gold 200 · 甘南", "sequence": item["sequence"],
        "frame": None, "rotation_degrees": item["rotation"],
        "bytes": len(best), "tags": ["Color", "Film"]}


def main():
    roll_id, source_arg = sys.argv[1:3]
    site = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).resolve().parent
    config = json.loads((site / "film_imports.json").read_text(encoding="utf-8"))[roll_id]
    source = Path(source_arg)
    output = site / "photos" / roll_id
    excluded = set(config["excluded_stems"])
    items = [item for item in config["sources"] if Path(item["name"]).stem not in excluded]
    assert items and len({item["name"] for item in items}) == len(items)
    for folder in ("full", "thumbs"):
        (output / folder).mkdir(parents=True, exist_ok=True)
        for stem in excluded:
            (output / folder / (stem + ".jpg")).unlink(missing_ok=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(lambda item: convert(item, source, output, roll_id), items))
    records.sort(key=lambda item: item["sequence"])
    manifest = json.dumps(records, ensure_ascii=False, indent=2)
    (output / "photos_info.json").write_bytes((manifest + "\n").encode("utf-8"))
    (output / "photos_info.js").write_bytes(("window.FILM_ROLL_PHOTOS = " + manifest + ";\n").encode("utf-8"))
    print(json.dumps({"count":len(records), "total_MB":sum(r["bytes"] for r in records)/1e6,
        "min_MB":min(r["bytes"] for r in records)/1e6,
        "max_MB":max(r["bytes"] for r in records)/1e6}), flush=True)


if __name__ == "__main__":
    main()
