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
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash-002")

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

class TodayReflectionRequest(BaseModel):
    reflection_text: str
    style: str = "diary"

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
        
        # レスポンスをパース
        lines = result_text.strip().split('\n')
        diary_text = ""
        image_prompt = ""
        
        for line in lines:
            if line.startswith("日記文:"):
                diary_text = line.replace("日記文:", "").strip()
            elif line.startswith("画像プロンプト:"):
                image_prompt = line.replace("画像プロンプト:", "").strip()
            elif "watercolor" in line.lower():
                image_prompt = line.strip()
        
        # フォールバック
        if not diary_text:
            diary_text = result_text[:200] if result_text else "素敵な一日だった！"
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
        
        # レスポンスをパース
        lines = result_text.strip().split('\n')
        diary_text = ""
        image_prompt = ""
        
        for line in lines:
            if line.startswith("日記文:"):
                diary_text = line.replace("日記文:", "").strip()
            elif line.startswith("画像プロンプト:"):
                image_prompt = line.replace("画像プロンプト:", "").strip()
            elif "watercolor" in line.lower():
                image_prompt = line.strip()
        
        # フォールバック
        if not diary_text:
            diary_text = request.reflection_text[:200] if request.reflection_text else "今日も良い一日だった。"
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