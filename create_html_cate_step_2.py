"""Step 2: build the location drawer shared by all photo pages.

When adding a new location folder under D:\\LR\\My_Gallery, add its folder
name and display name to LOCATION_MAPPING below, then run this file.
"""

from html import escape
from pathlib import Path


SOURCE_ROOT = Path(r"D:\LR\My_Gallery")
SITE_ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = SITE_ROOT / "archive_menu.html"

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
    "Pere_lachaise": "拉雪兹神父墓地", "Sacre_coeur": "圣心大教堂",
    "Seine": "塞纳河", "Tullerie": "杜乐丽公园", "Sweden": "瑞典",
    "Goteborg": "哥德堡", "Stok": "斯德哥尔摩", "Centre": "市中心",
    "photo_museum": "摄影博物馆", "Subway": "地铁", "Bordeaux": "波尔多",
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


def label_for(folder: Path) -> str:
    return LOCATION_MAPPING.get(folder.name, folder.name.replace("_", " "))


def visible_directories(folder: Path) -> list[Path]:
    return sorted(
        (path for path in folder.iterdir() if path.is_dir() and not path.name.startswith(".")),
        key=lambda path: label_for(path).casefold(),
    )


def page_url(folder: Path) -> str:
    relative = folder.relative_to(SOURCE_ROOT).as_posix()
    return f"/My_Gallery/{relative}/photo-v2.html"


def render_folder(folder: Path, depth: int = 0) -> list[str]:
    label = label_for(folder)
    english = folder.name.replace("_", " ")
    children = visible_directories(folder)
    indent = "  " * depth

    if not children:
        return [
            f'{indent}<a href="{escape(page_url(folder))}">{escape(label)} '
            f'<span>{escape(english)}</span></a>'
        ]

    lines = [f"{indent}<details>"]
    lines.append(f'{indent}  <summary>{escape(label)} <span>{escape(english)}</span></summary>')
    lines.append(f'{indent}  <a href="{escape(page_url(folder))}">全部 / {escape(label)}</a>')
    for child in children:
        lines.extend(render_folder(child, depth + 1))
    lines.append(f"{indent}</details>")
    return lines


def build_archive_menu() -> str:
    lines = [
        '<nav class="place-list" aria-label="摄影地点">',
        '  <a class="place-list__all" href="/photo-v2.html">全部地点 <span>ALL PLACES</span></a>',
    ]
    for folder in visible_directories(SOURCE_ROOT):
        lines.extend(render_folder(folder, 1))
    lines.append("</nav>")
    return "\n".join(lines)


def validate_mapping() -> None:
    folder_names = {
        folder.name for folder in SOURCE_ROOT.rglob("*")
        if folder.is_dir() and not folder.name.startswith(".")
    }
    missing = sorted(folder_names - LOCATION_MAPPING.keys())
    if missing:
        print("提示：以下目录没有中文映射，将显示其文件夹名称：")
        for name in missing:
            print(f'  "{name}": "待填写",')


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"图库目录不存在：{SOURCE_ROOT}")
    validate_mapping()
    OUTPUT_FILE.write_text(build_archive_menu(), encoding="utf-8")
    print(f"完成：地点菜单已更新到 {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
