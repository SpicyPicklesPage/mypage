import os
import json
import time
from http import HTTPStatus
import dashscope
from PIL import Image

# ================= 配置区域 =================

# 1. 您的阿里云 API Key
# 建议去 https://bailian.console.aliyun.com/ 查看
API_KEY = "sk-e9e3b62cfdd249e791ecce6cf4f913c0"  # <--- 【请替换您的 Key】

# 2. 路径配置
ROOT_FOLDER = r"D:\Lr\My_Gallery"      
MASTER_JSON_PATH = "master_photos.json" 

# 3. 模型选择
# qwen-vl-max: 效果最好，描述最细腻 (推荐)
# qwen-vl-plus: 性价比高
MODEL_NAME = 'qwen-vl-plus' 

# 设置 SDK Key
dashscope.api_key = API_KEY

# 4. 提示词 (Prompt)
PROMPT = """
作为一个专业的摄影策展人，请简要分析这张照片。
请返回严格的 JSON 格式，包含以下字段：
1. "description": 画面内容的详细视觉描述。
2. "mood": 传达的情绪或氛围（如：孤独、宁静、赛博朋克）。
3. "composition": 构图手法。
4. "colors": 主要色调描述。
请直接返回 JSON 字符串，不要包含 Markdown 标记（不要用 ```json 包裹）。
"""

# ================= 核心功能函数 =================

def load_master_db():
    if os.path.exists(MASTER_JSON_PATH):
        try:
            with open(MASTER_JSON_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return {item['id']: item for item in data if 'id' in item}
                return data
        except json.JSONDecodeError:
            return {}
    return {}

def save_master_db(data_dict):
    data_list = list(data_dict.values())
    with open(MASTER_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data_list, f, indent=4, ensure_ascii=False)
    print("💾 进度已保存。")

def build_file_map(root_folder):
    print("🔍 正在建立文件索引...")
    file_map = {}
    for root, dirs, files in os.walk(root_folder):
        for filename in files:
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                file_map[filename] = os.path.join(root, filename)
    print(f"✅ 索引建立完成，共找到 {len(file_map)} 个图片文件。")
    return file_map

def analyze_with_qwen(img_path, max_retries=3):
    """
    使用通义千问 VL 进行分析
    """
    # 阿里云支持直接传本地文件路径，但格式要是 file://
    # Windows 路径需要转义，例如 file://D:/Photos/abc.jpg
    # 但 DashScope Python SDK 有个坑，有时候直接传 file:// 不稳
    # 最稳妥的方法是：简单压缩后直接传文件路径字符串，SDK会自动处理上传
    
    # 为了省流量和加速，先压缩临时文件
    temp_path = "temp_upload.jpg"
    try:
        img = Image.open(img_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # 限制大小，Qwen-VL 建议长边不超过 2048，这里用 1024 足够分析且速度快
        if max(img.size) > 1024:
            img.thumbnail((1024, 1024))
        
        img.save(temp_path, format='JPEG', quality=80)
        local_file_url = os.path.abspath(temp_path)
        # Windows下路径修正
        local_file_url = f"file://{local_file_url}"
    except Exception as e:
        print(f"❌ 图片预处理失败: {e}")
        return None

    for attempt in range(max_retries):
        try:
            messages = [
                {
                    'role': 'user',
                    'content': [
                        {'image': local_file_url}, # 传入本地图片路径
                        {'text': PROMPT}
                    ]
                }
            ]
            
            response = dashscope.MultiModalConversation.call(
                model=MODEL_NAME,
                messages=messages
            )

            # 检查响应状态
            if response.status_code == HTTPStatus.OK:
                # 解析返回的文本
                content = response.output.choices[0].message.content[0]['text']
                
                # 清洗 JSON 格式
                content = content.replace("```json", "").replace("```", "").strip()
                if content.lower().startswith("json"):
                    content = content[4:].strip()
                
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # 有时候模型可能没返回完美 JSON，这里简单重试或跳过
                    print(f"⚠️ 返回内容不是有效 JSON: {content[:50]}...")
                    continue
            else:
                # API 报错（如限流）
                print(f"⚠️ API 错误 Code: {response.code}, Message: {response.message}")
                time.sleep(2) # 遇到错误稍微等一下

        except Exception as e:
            print(f"⚠️ 尝试 {attempt+1}/{max_retries} 失败: {e}")
            time.sleep(2)
            
    return None

# ================= 主流程 =================
def process_ai_analysis():
    db = load_master_db()
    if not db:
        print("❌ 数据库为空。")
        return

    # --- 【修复】筛选逻辑修改 ---
    # data.get('ai_analysis') is None 会同时覆盖：
    # 1. 字典里完全没有 'ai_analysis' 这个键
    # 2. 字典里有这个键，但值是 None (null)
    pending_ids = [
        pid for pid, data in db.items() 
        if (data.get('ai_analysis') is None) and 'filename' in data
    ]
    
    print(f"📊 待分析: {len(pending_ids)} 张。")
    if not pending_ids: return

    file_map = build_file_map(ROOT_FOLDER)

    print(f"\n🚀 开始 AI 批量分析 (使用阿里云 {MODEL_NAME})...")
    success_count = 0
    
    try:
        for i, pid in enumerate(pending_ids):
            photo_data = db[pid]
            filename = photo_data.get('filename')
            
            print(f"[{i+1}/{len(pending_ids)}] 分析中: {filename} ...", end="", flush=True)
            
            img_path = file_map.get(filename)
            # 兼容处理：尝试从 ID 中提取路径
            if not img_path and os.path.exists(str(pid).split('_')[0]): 
                 img_path = str(pid).split('_')[0]

            if not img_path or not os.path.exists(img_path):
                print(" ❌ 文件未找到")
                continue

            # 执行分析
            analysis_result = analyze_with_qwen(img_path)
            
            if analysis_result:
                db[pid]['ai_analysis'] = analysis_result
                print(f" ✅ 完成 ({analysis_result.get('mood', 'Done')})")
                success_count += 1
            else:
                print(" ❌ 失败 (跳过)")

            if success_count > 0 and success_count % 3 == 0:
                save_master_db(db)
            
            time.sleep(1.5)

    except KeyboardInterrupt:
        print("\n🛑 用户停止。")
    
    finally:
        if os.path.exists("temp_upload.jpg"):
            os.remove("temp_upload.jpg")
        save_master_db(db)
        print(f"\n✨ 任务结束。成功: {success_count} 张。")
        
if __name__ == "__main__":
    process_ai_analysis()