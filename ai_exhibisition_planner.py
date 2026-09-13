import json
import os
import random
from http import HTTPStatus
import dashscope
from sentence_transformers import SentenceTransformer, util

# ================= 配置 =================
API_KEY = "sk-e9e3b62cfdd249e791ecce6cf4f913c0"  # 您的阿里云 Key
dashscope.api_key = API_KEY
MODEL_NAME = 'qwen-max' # 使用最聪明的模型来做编排

MASTER_JSON_PATH = "master_photos.json"
OUTPUT_JSON_PATH = "story_exhibition.json"

# 加载向量模型 (用于海选)
print("⏳ 正在加载向量模型...")
vec_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

def load_db():
    if not os.path.exists(MASTER_JSON_PATH): return []
    with open(MASTER_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict): return list(data.values())
        return data

def vector_search(theme, photos, top_k=30):
    """阶段一：海选 (找出相关的素材)"""
    print(f"🔍 阶段一：正在海选与「{theme}」相关的素材...")
    
    valid_photos = [p for p in photos if p.get('ai_analysis')]
    corpus_texts = []
    
    for p in valid_photos:
        ai = p['ai_analysis']
        # 拼接用于检索的文本
        text = f"{ai.get('description')} {ai.get('mood')} {ai.get('colors')}"
        corpus_texts.append(text)
        
    corpus_embeddings = vec_model.encode(corpus_texts, convert_to_tensor=True)
    query_embedding = vec_model.encode(theme, convert_to_tensor=True)
    
    cos_scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
    top_results = list(zip(cos_scores, range(len(valid_photos))))
    top_results.sort(key=lambda x: x[0], reverse=True)
    
    # 返回前 K 张候选图
    candidates = []
    for score, idx in top_results[:top_k]:
        candidates.append(valid_photos[idx])
        
    return candidates

def llm_curate_story(theme, candidates):
    """阶段二：导演剪辑 (LLM 排序与叙事)"""
    print(f"🎬 阶段二：AI 导演正在编排故事线...")

    # 1. 准备给 LLM 看的简化版数据 (节省 Token)
    candidates_info = []
    for p in candidates:
        info = {
            "id": p['id'], # 必须要有 ID 才能找回原图
            "desc": p['ai_analysis'].get('description'),
            "mood": p['ai_analysis'].get('mood'),
            "color": p['ai_analysis'].get('colors')
        }
        candidates_info.append(info)

    # 2. 构造导演提示词
    prompt = f"""
    你是一位世界顶级的摄影策展人。这里有 {len(candidates)} 张候选照片。
    请根据主题「{theme}」，从中挑选 10 到 14 张最好的照片，并**按照叙事逻辑重新排序**。

    叙事逻辑要求：
    1. 不要只是堆砌，要有起承转合（例如：从压抑到释放，从清晨到日落，从远景到特写）。
    2. 每张照片都需要写一句简短的“策展人旁白”(comment)，串联起整个故事。

    请严格返回 JSON 格式列表，不要包含 Markdown 标记。格式如下：
    [
        {{"id": "照片ID", "comment": "开篇：这张照片通过..."}},
        {{"id": "照片ID", "comment": "转折：随后我们看到了..."}}
    ]

    候选照片数据：
    {json.dumps(candidates_info, ensure_ascii=False)}
    """

    # 3. 调用 Qwen-Max
    try:
        response = dashscope.Generation.call(
            model=MODEL_NAME,
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )

        if response.status_code == HTTPStatus.OK:
            content = response.output.choices[0].message.content
            # 清洗 JSON
            content = content.replace("```json", "").replace("```", "").strip()
            story_list = json.loads(content)
            return story_list
        else:
            print(f"❌ LLM 调用失败: {response.message}")
            return []
            
    except Exception as e:
        print(f"❌ 编排发生错误: {e}")
        return []

def main():
    theme = input("请输入策展故事主题 (例如 '孤独的夜行者', '从城市逃离到荒野'): ")
    if not theme: return

    all_photos = load_db()
    
    # 1. 海选
    candidates = vector_search(theme, all_photos, top_k=30)
    if not candidates:
        print("没有找到足够的素材。")
        return

    # 2. 编排
    story_sequence = llm_curate_story(theme, candidates)
    
    if not story_sequence:
        print("AI 编排失败，请重试。")
        return

    # 3. 组装最终结果
    final_exhibition = []
    # 创建一个快速查找字典
    photo_map = {p['id']: p for p in candidates}

    print("\n🎞️ 最终故事板:")
    for item in story_sequence:
        pid = item.get('id')
        comment = item.get('comment')
        
        if pid in photo_map:
            original_photo = photo_map[pid]
            # 注入新的策展人旁白，覆盖原本的 AI 描述，或者单独存一个字段
            exhibition_item = original_photo.copy()
            exhibition_item['curator_comment'] = comment # 专门给前端用的新字段
            
            final_exhibition.append(exhibition_item)
            print(f"  -> {comment} [{original_photo['filename']}]")

    # 4. 保存
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_exhibition, f, indent=4, ensure_ascii=False)

    print(f"\n✅ 策展完成！已生成 {OUTPUT_JSON_PATH}")
    print(f"共入选 {len(final_exhibition)} 张作品。")

if __name__ == "__main__":
    main()