from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator
import re
import time

def translate_text(text):
    translator = GoogleTranslator(source="zh-CN", target="en")
    translation = translator.translate(text)
    print(translation)
    time.sleep(1)
    return re.sub(r"\W+", "", translation)


def extract_titles(html_file):
    with open(html_file, "r", encoding="utf-8") as file:
        content = file.read()

    soup = BeautifulSoup(content, "lxml")
    sidebar_html = '<link href="content_note.css" rel="stylesheet" type="text/css"/>\n</head>\n<body>\n<button id="sidebar-toggle"></button>'
    sidebar_html += '<div id="sidebar">\n  <h2>目录</h2>\n  <ul>\n'
    last_level = 1

    for header in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        level = int(header.name[1])
        title = header.text.strip()
        header_id = translate_text(title)

        # 更新原HTML文件中的标题ID
        header["id"] = header_id

        if level > last_level:
            sidebar_html += " " * (4 * (level - last_level)) + "<ul>\n"
        elif level < last_level:
            sidebar_html += " " * (4 * (last_level - level)) + "</ul>\n"

        sidebar_html += (
            " " * (4 * level) + f'<li><a href="#{header_id}">{title}</a></li>\n'
        )
        last_level = level

    sidebar_html += " " * (4 * last_level) + "</ul>\n</div>"+'\n<script src="sidebar.js"></script>'

    # 将更新后的HTML内容写回文件
    with open(html_file, "w", encoding="utf-8") as file:
        file.write(str(soup))

    return sidebar_html


# 使用示例
html_directory = extract_titles("供应商管理手册读书笔记.html")
print(html_directory)
