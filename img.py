import os

# 图片文件夹路径
photos_dir = 'photos'
# 输出的HTML文件路径
output_html = 'index_.html'

# 获取photos文件夹中所有的.jpg文件
image_files = [f for f in os.listdir(photos_dir) if f.lower().endswith('.jpg')]

# 创建图片元素的HTML字符串
image_elements = '\n'.join(
    f'<img src="{os.path.join(filename)}" alt="{filename}">'
    for filename in image_files
)

# 创建整个HTML页面的内容
html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Photo Gallery</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .gallery {{
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            margin-top: 20px;
        }}
        .gallery img {{
            max-width: 200px; /* Adjust the size as needed */
            border: 1px solid #ccc;
            padding: 5px;
            background-color: #f8f8f8;
        }}
    </style>
</head>
<body>
    <h1>Photo Gallery</h1>
    <div class="gallery">
        {image_elements}
    </div>
</body>
</html>
"""

# 将HTML内容写入到index.html文件
with open(output_html, 'w') as file:
    file.write(html_content)

print(f"The index.html file has been created in the {photos_dir} directory.")
