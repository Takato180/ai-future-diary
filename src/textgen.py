import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .db import get_user

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
    user_id: str | None = None  # プロフィール情報取得用

class TodayReflectionRequest(BaseModel):
    reflection_text: str
    style: str = "diary"
    use_ai: bool = True  # AI使用するかどうか
    user_id: str | None = None  # プロフィール情報取得用

class TextGenerateResponse(BaseModel):
    generated_text: str
    image_prompt: str

class ActivitySuggestionRequest(BaseModel):
    user_id: str | None = None
    date: str | None = None  # YYYY-MM-DD format
    location_query: str | None = None  # 位置検索用（オプション）

class ActivitySuggestionResponse(BaseModel):
    suggestions: list[str]
    local_events: list[str] = []
    reasoning: str

def _get_gemini_model():
    if not VERTEX_AVAILABLE:
        raise HTTPException(500, "Vertex AI is not available")
    return GenerativeModel(GEMINI_MODEL)

async def _get_user_profile_context(user_id: str | None) -> str:
    """ユーザープロフィール情報からコンテキスト文字列を生成"""
    if not user_id:
        return ""

    try:
        user = await get_user(user_id)
        if not user:
            return ""

        context_parts = []

        # 年齢計算
        if user.birth_date:
            from datetime import datetime
            try:
                birth_date = datetime.strptime(user.birth_date, "%Y-%m-%d")
                age = datetime.now().year - birth_date.year
                context_parts.append(f"年齢: {age}歳")
            except:
                pass

        # 基本情報
        if user.gender:
            context_parts.append(f"性別: {user.gender}")
        if user.occupation:
            context_parts.append(f"職種: {user.occupation}")

        # ライフスタイル
        if user.hobbies:
            context_parts.append(f"趣味: {user.hobbies}")
        if user.favorite_places:
            context_parts.append(f"好きな場所: {user.favorite_places}")
        if user.family_structure:
            context_parts.append(f"家族構成: {user.family_structure}")
        if user.living_area:
            context_parts.append(f"住環境: {user.living_area}")

        # 住所情報
        location_parts = []
        if user.prefecture:
            location_parts.append(user.prefecture)
        if user.city:
            location_parts.append(user.city)
        if location_parts:
            context_parts.append(f"居住地: {' '.join(location_parts)}")

        # 好み
        if user.favorite_colors:
            colors = "、".join(user.favorite_colors)
            context_parts.append(f"好きな色: {colors}")
        if user.personality_type:
            context_parts.append(f"性格: {user.personality_type}")
        if user.favorite_season:
            context_parts.append(f"好きな季節: {user.favorite_season}")

        if context_parts:
            return f"ユーザー情報: {user.userName}さん（{', '.join(context_parts)}）"
        else:
            return f"ユーザー: {user.userName}さん"

    except Exception as e:
        print(f"Profile context generation failed: {e}")
        return ""

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

        # プロフィール情報を取得
        profile_context = await _get_user_profile_context(request.user_id)

        # プロンプト構築
        if request.plan:
            # 予定がある場合
            prompt = f"""
あなたは創作的な日記作家です。以下の明日の予定をもとに、楽しい未来日記を書いてください。

{profile_context}

明日の予定: {request.plan}

要件:
1. 日記風の文章で、わくわくする気持ちを表現
2. 150文字程度
3. 「〜だった」「〜した」のような過去形で書く（未来日記なので）
4. 絵日記らしい親しみやすい文体
5. ユーザーの個性や好み、ライフスタイルを反映させて
6. 年齢や職種、趣味などを考慮した自然な表現にする

また、この日記内容とユーザーの特徴に合う挿絵のプロンプトも生成してください。
プロンプトは英語で、水彩画風のやわらかい雰囲気で、ユーザーの好きな色や性格も考慮して。

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
あなたは創作的な日記作家です。明日の予定が特にない人に向けて、以下の興味・趣味とプロフィール情報をもとに楽しい一日の提案と未来日記を書いてください。

{profile_context}

興味・趣味: {interests_text}

要件:
1. まず明日のおすすめ活動を1-2個提案（ユーザーの年齢、職種、性格、住環境を考慮）
2. その活動をした後の日記風文章を作成
3. 150文字程度
4. 「〜だった」「〜した」のような過去形で書く（未来日記なので）
5. 絵日記らしい親しみやすい文体
6. ユーザーの個性や好み、ライフスタイルを反映させて

また、この日記内容とユーザーの特徴に合う挿絵のプロンプトも生成してください。
プロンプトは英語で、水彩画風のやわらかい雰囲気で、ユーザーの好きな色や性格も考慮して。

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

        # プロフィール情報を取得
        profile_context = await _get_user_profile_context(request.user_id)

        prompt = f"""
あなたは日記の編集者です。以下のユーザーの振り返りテキストを、読みやすい日記風に整理してください。

{profile_context}

入力テキスト: {request.reflection_text}

要件:
1. 誤字脱字を修正
2. 日記らしい文体に調整
3. 150文字程度に簡潔にまとめる
4. 感情や体験を大切に表現
5. 過去形で統一
6. ユーザーの個性や好み、ライフスタイルを反映させて
7. 年齢や職種、趣味などを考慮した自然な表現にする

また、この日記内容とユーザーの特徴に合う挿絵のプロンプトも生成してください。
プロンプトは英語で、水彩画風のやわらかい雰囲気で、ユーザーの好きな色や性格も考慮して。

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

@router.post("/activity-suggestions", response_model=ActivitySuggestionResponse)
async def suggest_activities(request: ActivitySuggestionRequest):
    """プロフィール情報とイベント情報をもとに活動を提案"""
    try:
        model = _get_gemini_model()

        # プロフィール情報を取得
        profile_context = await _get_user_profile_context(request.user_id)

        # 現在の日付と季節情報を取得
        from datetime import datetime

        target_date = request.date or datetime.now().strftime("%Y-%m-%d")
        current_date = datetime.now()
        season = ["冬", "冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬"][current_date.month - 1]
        weekday = ["月", "火", "水", "木", "金", "土", "日"][current_date.weekday()]

        # AI提案を生成
        prompt = f"""
あなたは活動提案の専門家です。以下の情報をもとに、ユーザーにおすすめの活動を5つ提案してください。

{profile_context}

日付情報:
- 対象日: {target_date}
- 現在の季節: {season}
- 曜日: {weekday}曜日

要件:
1. ユーザーのプロフィール（年齢、職種、趣味、住環境、性格など）を考慮
2. 季節や曜日に適した活動を提案
3. 実現可能で具体的な活動にする
4. 1つの提案は20文字以内で簡潔に
5. 多様性を持たせ、インドア・アウトドア・文化的活動をバランスよく

また、なぜこれらの活動を提案したかの理由も100文字程度で説明してください。

以下の形式で返答してください:
```
提案1: [活動名]
提案2: [活動名]
提案3: [活動名]
提案4: [活動名]
提案5: [活動名]
理由: [提案理由の説明]
```
"""

        response = model.generate_content(prompt)
        result_text = response.text

        # レスポンスをパース
        suggestions = []
        reasoning = ""

        lines = result_text.replace('```', '').strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('提案') and ':' in line:
                suggestion = line.split(':', 1)[1].strip()
                if suggestion:
                    suggestions.append(suggestion)
            elif line.startswith('理由:'):
                reasoning = line.split(':', 1)[1].strip()

        # フォールバック
        if not suggestions:
            suggestions = ["散歩", "読書", "カフェでコーヒー", "ストレッチ", "音楽鑑賞"]
        if not reasoning:
            reasoning = "プロフィール情報をもとに、バランスの取れた活動を提案しました。"

        return ActivitySuggestionResponse(
            suggestions=suggestions,
            local_events=[],
            reasoning=reasoning
        )

    except Exception as e:
        print(f"Activity suggestion failed: {e}")
        # フォールバック提案
        return ActivitySuggestionResponse(
            suggestions=["散歩", "読書", "カフェでコーヒー", "ストレッチ", "音楽鑑賞"],
            local_events=[],
            reasoning="プロフィール情報の取得に失敗したため、一般的な活動を提案しています。"
        )