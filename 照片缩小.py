from pathlib import Path
from PIL import Image, ImageOps
import io
import os

# =========================
# 配置
# =========================

# 修改成你的照片文件夹
INPUT_DIR = r"photos"

# 最大文件大小
MAX_SIZE_KB = 400

# 建议主要处理 JPG/JPEG
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg"}

MIN_QUALITY = 40
MAX_QUALITY = 95

# 如果降低质量仍然超过 400KB，
# 每次将宽高缩小到原来的 90%
RESIZE_RATIO = 0.9


def encode_jpeg(img, quality):
    buffer = io.BytesIO()

    img.save(
        buffer,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True
    )

    return buffer.getvalue()


def find_best_quality(img, max_bytes):
    """
    在满足 400KB 的情况下，
    尽可能寻找最高 JPEG 质量
    """
    low = MIN_QUALITY
    high = MAX_QUALITY

    best_data = None
    best_quality = None

    while low <= high:
        quality = (low + high) // 2

        data = encode_jpeg(img, quality)

        if len(data) <= max_bytes:
            best_data = data
            best_quality = quality

            # 尝试提高质量
            low = quality + 1
        else:
            high = quality - 1

    return best_data, best_quality


def compress_in_place(image_path, max_size_kb=400):

    max_bytes = max_size_kb * 1024

    original_size = image_path.stat().st_size

    # 本来就小于 400KB，不处理
    if original_size <= max_bytes:
        print(
            f"跳过：{image_path.name} "
            f"({original_size / 1024:.1f} KB)"
        )
        return

    with Image.open(image_path) as img:

        # 修复手机照片方向
        img = ImageOps.exif_transpose(img)

        img = img.convert("RGB")

        original_width, original_height = img.size

        current_img = img

        while True:

            data, quality = find_best_quality(
                current_img,
                max_bytes
            )

            if data is not None:

                # 先写入临时文件
                temp_path = image_path.with_name(
                    image_path.stem
                    + "_compressing"
                    + image_path.suffix
                )

                with open(temp_path, "wb") as f:
                    f.write(data)

                # 成功后覆盖原文件
                os.replace(temp_path, image_path)

                final_width, final_height = current_img.size

                print(
                    f"✓ {image_path.name} | "
                    f"{original_size / 1024:.1f}KB"
                    f" → {len(data) / 1024:.1f}KB | "
                    f"{original_width}×{original_height}"
                    f" → {final_width}×{final_height} | "
                    f"质量={quality}"
                )

                return

            # 最低质量都无法压到 400KB
            # 开始等比例缩小分辨率

            width, height = current_img.size

            new_width = int(width * RESIZE_RATIO)
            new_height = int(height * RESIZE_RATIO)

            if new_width < 100 or new_height < 100:
                print(f"⚠ 无法压缩：{image_path.name}")
                return

            current_img = current_img.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS
            )


def process_folder():

    folder = Path(INPUT_DIR)

    if not folder.exists():
        print(f"找不到文件夹：{folder}")
        return

    images = [
        p for p in folder.iterdir()
        if p.is_file()
        and p.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    print(f"找到 {len(images)} 张 JPG 照片")
    print(f"目标：每张 ≤ {MAX_SIZE_KB} KB\n")

    for i, path in enumerate(images, 1):

        print(f"[{i}/{len(images)}]", end=" ")

        try:
            compress_in_place(
                path,
                MAX_SIZE_KB
            )

        except Exception as e:
            print(
                f"✗ {path.name} 处理失败：{e}"
            )

    print("\n全部处理完成。")


if __name__ == "__main__":
    process_folder()