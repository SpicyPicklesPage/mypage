"""Step 2 (V2): build the archive drawer used by generated photo-v2 pages.

Add every new folder name to LOCATION_MAPPING, then run this script.
The generated fragment is consumed by create_all_locations_step_3_v2.py.
"""

from html import escape
from pathlib import Path


SOURCE_ROOT = Path(r"D:\LR\My_Gallery")
SITE_ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = SITE_ROOT / "archive_menu_v2.html"

LOCATION_MAPPING = {
    "Danmark": "丹麦", "Kobenhaven": "哥本哈根", "Church": "教堂",
    "Church_organ": "风琴教堂", "Design_Museum": "设计博物馆",
    "Louisanna": "路易斯安娜博物馆", "New_Museum": "新艺术博物馆",
    "New_Quai": "新港", "Sea": "海边", "France": "法国", "Dijon": "第戎",
    "Dunkerque": "敦刻尔克", "Paris": "巴黎", "Arc": "凯旋门",
    "Caodong": "草东", "centre": "市中心", "champs-sur-marnes": "田野马恩河",
    "chatelet": "夏特雷", "Eiffel_Tower": "埃菲尔铁塔", "ens": "巴黎高师",
    "Hotel_de_Ville": "市政厅", "Lib_de_paris": "巴黎图书馆",
    "Musee_Orsay": "奥赛博物馆", "Notre_dame": "巴黎圣母院",
    "Pere_lachaise": "拉夫雪兹神父墓地", "Sacre_coeur": "圣心大教堂",
    "Seine": "塞纳河", "Tullerie": "杜乐丽公园", "Sweden": "瑞典",
    "Goteborg": "哥德堡", "Stok": "斯德哥尔摩", "Centre": "市中心",
    "photo_museum": "照片博物馆", "Subway": "地铁", "Bordeaux": "波尔多",
    "Parc_floral": "鲜花公园", "Lille": "里尔", "Italy": "意大利",
    "Naples": "那不勒斯", "Amalfi_coach": "阿马尔菲海岸",
    "Pompee": "庞贝古城", "naples_city": "那不勒斯城区",
    "Luxembourg": "卢森堡", "Croatia": "克罗地亚", "Zagreb": "萨格勒布",
    "BosniaAndHerzegovina": "波黑", "Sarajevo": "萨拉热窝",
    "Sarajevo_in_melancholy": "绿调萨拉热窝", "Egypt": "埃及",
    "Alexandria": "亚历山大", "Luxor": "卢克索", "Cairo": "开罗",
    "Aswan": "阿斯旺", "Hurghada": "赫尔格达", "Servia": "塞尔维亚",
    "Belgrad": "贝尔格莱德", "Hungry": "匈牙利", "Budapest": "布达佩斯",
    "Austria": "奥地利", "Vienna": "维也纳",
}


def visible_directories(folder: Path) -> list[Path]:
    return sorted(
        (path for path in folder.iterdir() if path.is_dir() and not path.name.startswith(".")),
        key=lambda path: LOCATION_MAPPING.get(path.name, path.name).casefold(),
    )


def page_url(folder: Path) -> str:
    relative = folder.relative_to(SOURCE_ROOT).as_posix()
    suffix = f"/{relative}" if relative != "." else ""
    return f"/My_Gallery{suffix}/photo-v2.html"


def render_folder(folder: Path, depth: int = 0) -> list[str]:
    label = LOCATION_MAPPING.get(folder.name, folder.name.replace("_", " "))
    english = folder.name.replace("_", " ")
    children = visible_directories(folder)
    indent = "  " * depth

    if not children:
        return [
            f'{indent}<a href="{escape(page_url(folder))}">{escape(label)} '
            f'<span>{escape(english)}</span></a>'
        ]

    lines = [f"{indent}<details>"]
    lines.append(
        f'{indent}  <summary>{escape(label)} <span>{escape(english)}</span></summary>'
    )
    lines.append(
        f'{indent}  <a href="{escape(page_url(folder))}">全部 / {escape(label)}</a>'
    )
    for child in children:
        lines.extend(render_folder(child, depth + 1))
    lines.append(f"{indent}</details>")
    return lines


def build_archive_menu() -> str:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"Gallery root does not exist: {SOURCE_ROOT}")

    lines = [
        '<nav class="place-list" aria-label="摄影地点">',
        '  <a class="place-list__all" href="/My_Gallery/photo-v2.html">全部地点 <span>ALL PLACES</span></a>',
    ]
    for folder in visible_directories(SOURCE_ROOT):
        lines.extend(render_folder(folder, 1))
    lines.append("</nav>")
    return "\n".join(lines)


def main() -> None:
    menu = build_archive_menu()
    OUTPUT_FILE.write_text(menu, encoding="utf-8")
    print(f"Done: archive menu saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
