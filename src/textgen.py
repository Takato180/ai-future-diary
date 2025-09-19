import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/text", tags=["text"])

# Vertex AI の安全なimport
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
    VERTEX_AVAILABLE = True
except ImportError as e:
    print(f"Vertex AI import failed: {e}")
    VERTEX_AVAILABLE = False

PROJECT_ID = os.environ.get("PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
VERTEX_LOCATION = os.environ.get("VERTEX_LOCATION", "us-central1")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Vertex AI 初期化
if VERTEX_AVAILABLE and PROJECT_ID and VERTEX_LOCATION:
    try:
        vertexai.init(project=PROJECT_ID, location=VERTEX_LOCATION)
        print("Vertex AI initialized successfully")
    except Exception as e:
        print(f"Vertex AI initialization failed: {e}")
        VERTEX_AVAILABLE = False

class FutureDiaryRequest(BaseModel):
    plan: str | None = None
    interests: list[str] | None = None
    style: str = "casual"
    use_ai: bool = True  # AI使用するかどうか

class TodayReflectionRequest(BaseModel):
    reflection_text: str
    style: str = "diary"
    use_ai: bool = True  # AI使用するかどうか

class TextGenerateResponse(BaseModel):
    generated_text: str
    image_prompt: str

def _get_gemini_model():
    if not VERTEX_AVAILABLE:
        raise HTTPException(500, "Vertex AI is not available")
    return GenerativeModel(GEMINI_MODEL)

@router.post("/future-diary", response_model=TextGenerateResponse)
async def generate_future_diary(request: FutureDiaryRequest):
    """
    明日の予定から未来日記を生成
    """
    if not PROJECT_ID:
        raise HTTPException(500, "PROJECT_ID is not set")

    try:
        # AI使用しない場合は原文をそのまま返す
        if not request.use_ai:
            plan_text = request.plan or "特に予定のない一日を過ごした。"
            return TextGenerateResponse(
                generated_text=plan_text,
                image_prompt="watercolor style, peaceful daily life scene, soft and warm illustration"
            )

        model = _get_gemini_model()

        # プロンプト構築
        if request.plan:
            # 予定がある場合
            prompt = f"""
あなたは創作的な日記作家です。以下の明日の予定をもとに、楽しい未来日記を書いてください。

明日の予定: {request.plan}

要件:
1. 日記風の文章で、わくわくする気持ちを表現
2. 150文字程度
3. 「〜だった」「〜した」のような過去形で書く（未来日記なので）
4. 絵日記らしい親しみやすい文体

また、この日記内容に合う挿絵のプロンプトも生成してください。
プロンプトは英語で、水彩画風のやわらかい雰囲気で。

以下の形式で返答してください:
```
日記文: ここに日記を書く
画像プロンプト: watercolor style, soft illustration of [具体的なシーン描写]
```
"""
        else:
            # 予定がない場合、趣味から提案
            interests_text = ", ".join(request.interests) if request.interests else "リラックス、読書、散歩"
            prompt = f"""
あなたは創作的な日記作家です。明日の予定が特にない人に向けて、以下の興味・趣味をもとに楽しい一日の提案と未来日記を書いてください。

興味・趣味: {interests_text}

要件:
1. まず明日のおすすめ活動を1-2個提案
2. その活動をした後の日記風文章を作成
3. 150文字程度
4. 「〜だった」「〜した」のような過去形で書く（未来日記なので）
5. 絵日記らしい親しみやすい文体

また、この日記内容に合う挿絵のプロンプトも生成してください。
プロンプトは英語で、水彩画風のやわらかい雰囲気で。

以下の形式で返答してください:
```
提案: ここに明日のおすすめ活動
日記文: ここに日記を書く
画像プロンプト: watercolor style, soft illustration of [具体的なシーン描写]
```
"""

        response = model.generate_content(prompt)
        result_text = response.text
        print(f"[DEBUG] Gemini response: {result_text}")  # デバッグ用

        # レスポンスをパース - より柔軟なアプローチ
        diary_text = ""
        image_prompt = ""

        # バッククォートを除去
        clean_text = result_text.replace('```', '').strip()
        lines = clean_text.split('\n')

        # パターン1: 明確な区切りがある場合
        for line in lines:
            line = line.strip()
            if line.startswith("日記文:") or line.startswith("日記:"):
                diary_text = line.split(":", 1)[1].strip()
            elif line.startswith("画像プロンプト:") or line.startswith("プロンプト:"):
                image_prompt = line.split(":", 1)[1].strip()
            elif "watercolor" in line.lower() and not image_prompt:
                image_prompt = line.strip()

        # パターン2: 区切りが曖昧な場合、日記らしい文章を探す
        if not diary_text:
            potential_diary_lines = []
            skip_next = False

            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue

                # 提案行やプロンプト関連はスキップ
                if any(word in line for word in ['提案:', '画像プロンプト:', 'watercolor', 'illustration', 'style']):
                    skip_next = True
                    continue

                # 日記らしい内容かチェック
                if len(line) > 15 and any(pattern in line for pattern in ['だった', 'した', 'になった', 'できた', 'いった', 'ました']):
                    # 複数行にわたる場合は結合
                    full_text = line
                    for j in range(i+1, min(i+3, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and not any(word in next_line for word in ['画像プロンプト:', 'watercolor', '提案:']):
                            if any(pattern in next_line for pattern in ['だった', 'した', 'になった', 'できた', 'いった', 'ました']):
                                full_text += next_line
                    potential_diary_lines.append(full_text)

            if potential_diary_lines:
                # 最も長くて内容がありそうなものを選択
                diary_text = max(potential_diary_lines, key=len)
                if len(diary_text) > 300:
                    diary_text = diary_text[:300] + "..."

        # パターン3: それでも見つからない場合、全体から抽出
        if not diary_text:
            # 明らかにプロンプト指示ではない、日記らしい文章を探す
            for line in lines:
                line = line.strip()
                if (len(line) > 20 and
                    not line.startswith(('要件', '以下', 'また', 'あなた', 'プロンプト', '```')) and
                    any(pattern in line for pattern in ['だった', 'した', 'た。', 'です。', 'である。']) and
                    'watercolor' not in line.lower()):
                    diary_text = line
                    break

        # 最終フォールバック
        if not diary_text:
            diary_text = "今日も新しい発見があって、とても充実した一日だった！"
                
        if not image_prompt:
            image_prompt = "watercolor style, peaceful daily life scene, soft and warm illustration"
        
        return TextGenerateResponse(
            generated_text=diary_text,
            image_prompt=image_prompt
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text generation failed: {str(e)}")

@router.post("/today-reflection", response_model=TextGenerateResponse)
async def generate_today_reflection(request: TodayReflectionRequest):
    """
    今日の振り返りテキストを整理・補正
    """
    if not PROJECT_ID:
        raise HTTPException(500, "PROJECT_ID is not set")

    try:
        # AI使用しない場合は原文をそのまま返す
        if not request.use_ai:
            return TextGenerateResponse(
                generated_text=request.reflection_text,
                image_prompt="watercolor style, peaceful daily life scene, soft and warm illustration"
            )

        model = _get_gemini_model()

        prompt = f"""
あなたは日記の編集者です。以下のユーザーの振り返りテキストを、読みやすい日記風に整理してください。

入力テキスト: {request.reflection_text}

要件:
1. 誤字脱字を修正
2. 日記らしい文体に調整
3. 150文字程度に簡潔にまとめる
4. 感情や体験を大切に表現
5. 過去形で統一

また、この日記内容に合う挿絵のプロンプトも生成してください。
プロンプトは英語で、水彩画風のやわらかい雰囲気で。

以下の形式で返答してください:
```
日記文: ここに整理された日記を書く
画像プロンプト: watercolor style, soft illustration of [具体的なシーン描写]
```
"""

        response = model.generate_content(prompt)
        result_text = response.text
        print(f"[DEBUG] Reflection response: {result_text}")  # デバッグ用

        # レスポンスをパース - future-diaryと同じロジック
        diary_text = ""
        image_prompt = ""

        # バッククォートを除去
        clean_text = result_text.replace('```', '').strip()
        lines = clean_text.split('\n')

        # パターン1: 明確な区切りがある場合
        for line in lines:
            line = line.strip()
            if line.startswith("日記文:") or line.startswith("日記:"):
                diary_text = line.split(":", 1)[1].strip()
            elif line.startswith("画像プロンプト:") or line.startswith("プロンプト:"):
                image_prompt = line.split(":", 1)[1].strip()
            elif "watercolor" in line.lower() and not image_prompt:
                image_prompt = line.strip()

        # パターン2: 区切りが曖昧な場合、日記らしい文章を探す
        if not diary_text:
            potential_diary_lines = []

            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue

                # プロンプト関連はスキップ
                if any(word in line for word in ['画像プロンプト:', 'watercolor', 'illustration', 'style']):
                    continue

                # 日記らしい内容かチェック
                if len(line) > 15 and any(pattern in line for pattern in ['だった', 'した', 'になった', 'できた', 'いった', 'ました']):
                    full_text = line
                    for j in range(i+1, min(i+3, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and not any(word in next_line for word in ['画像プロンプト:', 'watercolor']):
                            if any(pattern in next_line for pattern in ['だった', 'した', 'になった', 'できた', 'いった', 'ました']):
                                full_text += next_line
                    potential_diary_lines.append(full_text)

            if potential_diary_lines:
                diary_text = max(potential_diary_lines, key=len)
                if len(diary_text) > 300:
                    diary_text = diary_text[:300] + "..."

        # パターン3: それでも見つからない場合、全体から抽出
        if not diary_text:
            for line in lines:
                line = line.strip()
                if (len(line) > 20 and
                    not line.startswith(('要件', '以下', 'また', 'あなた', 'プロンプト', '```')) and
                    any(pattern in line for pattern in ['だった', 'した', 'た。', 'です。', 'である。']) and
                    'watercolor' not in line.lower()):
                    diary_text = line
                    break

        # 最終フォールバック
        if not diary_text:
            diary_text = request.reflection_text[:200] if request.reflection_text else "今日も心に残る体験ができた一日だった。"
                
        if not image_prompt:
            image_prompt = "watercolor style, peaceful daily life scene, soft and warm illustration"
        
        return TextGenerateResponse(
            generated_text=diary_text,
            image_prompt=image_prompt
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text generation failed: {str(e)}")

@router.get("/writing-styles")
def get_writing_styles():
    """利用可能な文体スタイル一覧"""
    return {
        "styles": [
            {"key": "casual", "name": "カジュアル", "description": "親しみやすい日常的な文体"},
            {"key": "formal", "name": "丁寧語", "description": "丁寧語を使った文体"},
            {"key": "poetic", "name": "詩的", "description": "少し詩的で美しい表現"},
            {"key": "cheerful", "name": "明るい", "description": "前向きで明るい文体"},
            {"key": "reflective", "name": "内省的", "description": "深く考える文体"}
        ]
    }