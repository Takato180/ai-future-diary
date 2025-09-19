import os
import hashlib
import secrets
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from google.cloud import firestore
from google.cloud.firestore import Client

# Firestore 設定
PROJECT_ID = os.environ.get("PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
DATABASE_ID = "ai-future-diary-history"

# Firestore クライアント
try:
    if PROJECT_ID:
        db: Client = firestore.Client(project=PROJECT_ID, database=DATABASE_ID)
        print(f"Firestore initialized: project={PROJECT_ID}, database={DATABASE_ID}")
    else:
        db = None
        print("PROJECT_ID not set, Firestore disabled")
except Exception as e:
    print(f"Firestore initialization failed: {e}")
    db = None

# データモデル
class User(BaseModel):
    userId: str
    userName: str
    passwordHash: str  # あいことばのハッシュ
    coverImageUrl: Optional[str] = None
    # プロフィール情報
    birth_date: Optional[str] = None  # YYYY-MM-DD形式
    gender: Optional[str] = None  # 男性/女性/その他/未設定
    occupation: Optional[str] = None  # 学生/会社員/主婦/フリーランス/退職/その他
    hobbies: Optional[str] = None  # 趣味・特技
    favorite_places: Optional[str] = None  # 好きな場所・よく行く場所
    family_structure: Optional[str] = None  # 一人暮らし/家族と同居/パートナーと二人暮らし/その他
    living_area: Optional[str] = None  # 都市部/郊外/田舎/海近く/山近く
    prefecture: Optional[str] = None  # 都道府県
    city: Optional[str] = None  # 市区町村
    favorite_colors: List[str] = Field(default_factory=list)  # 好きな色
    personality_type: Optional[str] = None  # アクティブ/インドア派/両方
    favorite_season: Optional[str] = None  # 春/夏/秋/冬
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    userName: str
    password: str  # あいことば

class UserLogin(BaseModel):
    userName: str
    password: str

class UserResponse(BaseModel):
    userId: str
    userName: str
    coverImageUrl: Optional[str] = None
    # プロフィール情報
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    hobbies: Optional[str] = None
    favorite_places: Optional[str] = None
    family_structure: Optional[str] = None
    living_area: Optional[str] = None
    prefecture: Optional[str] = None
    city: Optional[str] = None
    favorite_colors: List[str] = Field(default_factory=list)
    personality_type: Optional[str] = None
    favorite_season: Optional[str] = None
    createdAt: datetime

class UserProfileUpdate(BaseModel):
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    hobbies: Optional[str] = None
    favorite_places: Optional[str] = None
    family_structure: Optional[str] = None
    living_area: Optional[str] = None
    prefecture: Optional[str] = None
    city: Optional[str] = None
    favorite_colors: List[str] = Field(default_factory=list)
    personality_type: Optional[str] = None
    favorite_season: Optional[str] = None

class DiaryEntry(BaseModel):
    userId: str
    date: str  # YYYY-MM-DD format
    planText: Optional[str] = None
    planImageUrl: Optional[str] = None
    actualText: Optional[str] = None
    actualImageUrl: Optional[str] = None
    diffText: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1

class DiaryEntryCreate(BaseModel):
    userId: str = "anonymous"
    date: str
    planText: Optional[str] = None
    planImageUrl: Optional[str] = None
    actualText: Optional[str] = None
    actualImageUrl: Optional[str] = None
    diffText: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class DiaryEntryResponse(BaseModel):
    userId: str
    date: str
    planText: Optional[str] = None
    planImageUrl: Optional[str] = None
    actualText: Optional[str] = None
    actualImageUrl: Optional[str] = None
    diffText: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    createdAt: datetime
    updatedAt: datetime
    version: int

# データベース操作関数
async def save_diary_entry(entry: DiaryEntryCreate) -> DiaryEntry:
    """日記エントリを保存"""
    if not db:
        raise Exception("Firestore is not available")

    doc_id = f"{entry.userId}_{entry.date}"
    doc_ref = db.collection("entries").document(doc_id)

    # 既存エントリをチェック
    existing_doc = doc_ref.get()

    now = datetime.now(timezone.utc)

    if existing_doc.exists:
        # 更新
        existing_data = existing_doc.to_dict()
        updated_data = entry.model_dump(exclude_unset=True)
        updated_data.update({
            "updatedAt": now,
            "version": existing_data.get("version", 1) + 1
        })

        doc_ref.update(updated_data)

        # 更新されたドキュメントを取得
        updated_doc = doc_ref.get()
        data = updated_doc.to_dict()
        return DiaryEntry(**data)
    else:
        # 新規作成
        diary_entry = DiaryEntry(
            userId=entry.userId,
            date=entry.date,
            planText=entry.planText,
            planImageUrl=entry.planImageUrl,
            actualText=entry.actualText,
            actualImageUrl=entry.actualImageUrl,
            diffText=entry.diffText,
            tags=entry.tags,
            createdAt=now,
            updatedAt=now,
            version=1
        )

        doc_ref.set(diary_entry.model_dump())
        return diary_entry

async def get_diary_entry(user_id: str, date: str) -> Optional[DiaryEntryResponse]:
    """特定の日の日記エントリを取得"""
    if not db:
        raise Exception("Firestore is not available")

    doc_id = f"{user_id}_{date}"
    doc_ref = db.collection("entries").document(doc_id)
    doc = doc_ref.get()

    if doc.exists:
        data = doc.to_dict()
        return DiaryEntryResponse(**data)
    return None

async def get_diary_entries_by_month(user_id: str, year_month: str) -> List[DiaryEntryResponse]:
    """指定月の日記エントリ一覧を取得 (year_month: "YYYY-MM")"""
    if not db:
        raise Exception("Firestore is not available")

    # 月の範囲を計算
    start_date = f"{year_month}-01"

    # 次月の計算
    year, month = map(int, year_month.split("-"))
    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1
    end_date = f"{next_year:04d}-{next_month:02d}-01"

    # クエリ実行
    entries = []
    docs = (db.collection("entries")
            .where("userId", "==", user_id)
            .where("date", ">=", start_date)
            .where("date", "<", end_date)
            .order_by("date")
            .stream())

    for doc in docs:
        data = doc.to_dict()
        entries.append(DiaryEntryResponse(**data))

    return entries

async def generate_diff_summary(user_id: str, date: str, plan_text: str, actual_text: str) -> str:
    """予定と実際の差分要約を生成してFirestoreに保存"""
    from src.textgen import _get_gemini_model

    try:
        model = _get_gemini_model()

        prompt = f"""
以下の「予定」と「実際」を比較して、差分を要約してください。

予定: {plan_text}
実際: {actual_text}

要件:
1. 予定通りだった部分と違った部分を明確に分ける
2. 変化した理由や新しい発見があれば記載
3. 次回への学びや提案があれば記載
4. 150文字程度で簡潔に
5. 前向きで建設的な内容に

形式:
- 予定通り: [内容]
- 変化: [内容と理由]
- 学び: [次回への提案]
"""

        response = model.generate_content(prompt)
        diff_text = response.text.strip()

        # Firestoreに保存
        doc_id = f"{user_id}_{date}"
        doc_ref = db.collection("entries").document(doc_id)
        doc_ref.update({
            "diffText": diff_text,
            "updatedAt": datetime.now(timezone.utc)
        })

        return diff_text

    except Exception as e:
        return f"差分要約の生成に失敗しました: {str(e)}"

# ユーザー管理機能
def _hash_password(password: str) -> str:
    """あいことばをハッシュ化"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{password_hash.hex()}"

def _verify_password(password: str, password_hash: str) -> bool:
    """あいことばを検証"""
    try:
        salt, stored_hash = password_hash.split(':')
        password_hash_check = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return stored_hash == password_hash_check.hex()
    except:
        return False

async def create_user(user_create: UserCreate) -> UserResponse:
    """新規ユーザー作成"""
    if not db:
        raise Exception("Firestore is not available")

    # ユーザー名の重複チェック
    existing_users = db.collection("users").where("userName", "==", user_create.userName).limit(1).get()
    if existing_users:
        raise Exception("このユーザー名は既に使用されています")

    user_id = secrets.token_urlsafe(16)
    password_hash = _hash_password(user_create.password)

    now = datetime.now(timezone.utc)
    user = User(
        userId=user_id,
        userName=user_create.userName,
        passwordHash=password_hash,
        createdAt=now,
        updatedAt=now
    )

    # Firestoreに保存
    db.collection("users").document(user_id).set(user.model_dump())

    return UserResponse(
        userId=user.userId,
        userName=user.userName,
        coverImageUrl=user.coverImageUrl,
        createdAt=user.createdAt
    )

async def authenticate_user(user_login: UserLogin) -> Optional[UserResponse]:
    """ユーザー認証"""
    if not db:
        raise Exception("Firestore is not available")

    # ユーザー名でユーザーを検索
    users = db.collection("users").where("userName", "==", user_login.userName).limit(1).get()

    if not users:
        return None

    user_doc = users[0]
    user_data = user_doc.to_dict()

    # あいことばを検証
    if not _verify_password(user_login.password, user_data["passwordHash"]):
        return None

    return UserResponse(
        userId=user_data["userId"],
        userName=user_data["userName"],
        coverImageUrl=user_data.get("coverImageUrl"),
        createdAt=user_data["createdAt"]
    )

async def get_user(user_id: str) -> Optional[UserResponse]:
    """ユーザー情報を取得"""
    if not db:
        raise Exception("Firestore is not available")

    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists:
        return None

    user_data = user_doc.to_dict()
    return UserResponse(
        userId=user_data["userId"],
        userName=user_data["userName"],
        coverImageUrl=user_data.get("coverImageUrl"),
        createdAt=user_data["createdAt"]
    )

async def update_user_cover(user_id: str, cover_image_url: str) -> bool:
    """ユーザーの表紙画像を更新"""
    if not db:
        raise Exception("Firestore is not available")

    try:
        db.collection("users").document(user_id).update({
            "coverImageUrl": cover_image_url,
            "updatedAt": datetime.now(timezone.utc)
        })
        return True
    except Exception as e:
        print(f"Failed to update user cover: {e}")
        return False

async def update_user_profile(user_id: str, profile_data: UserProfileUpdate) -> bool:
    """ユーザーのプロフィール情報を更新"""
    if not db:
        raise Exception("Firestore is not available")

    try:
        # None以外の値のみ更新データに含める
        update_data = {}
        for field, value in profile_data.model_dump(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value

        # 更新日時を追加
        update_data["updatedAt"] = datetime.now(timezone.utc)

        print(f"[DEBUG] Updating user profile for {user_id}: {update_data}")

        if update_data:
            db.collection("users").document(user_id).update(update_data)
            print(f"[DEBUG] Successfully updated user profile for {user_id}")
        else:
            print(f"[DEBUG] No data to update for user {user_id}")
        return True
    except Exception as e:
        print(f"Failed to update user profile: {e}")
        return False

async def generate_user_cover(user_name: str) -> str:
    """ユーザーの表紙画像を生成"""
    from src.textgen import _get_gemini_model

    try:
        model = _get_gemini_model()

        prompt = f"""
{user_name}さんの日記帳の表紙画像を生成するプロンプトを作成してください。

要件:
1. 日記帳らしい温かみのあるデザイン
2. {user_name}という名前を活かした個性的な要素
3. 手作り感のある親しみやすい雰囲気
4. 水彩画風で優しい色合い

英語で画像生成プロンプトのみを返答してください:
"""

        response = model.generate_content(prompt)
        image_prompt = response.text.strip()

        if not image_prompt:
            # フォールバック
            image_prompt = f"watercolor style, handmade diary cover for {user_name}, warm and friendly design, soft pastel colors, journal notebook"

        return image_prompt

    except Exception as e:
        print(f"Failed to generate cover prompt: {e}")
        return f"watercolor style, handmade diary cover for {user_name}, warm and friendly design, soft pastel colors, journal notebook"

def get_firestore_status() -> Dict[str, Any]:
    """Firestore接続状態を確認"""
    if not db:
        return {
            "status": "disabled",
            "project_id": PROJECT_ID,
            "database_id": DATABASE_ID,
            "reason": "PROJECT_ID not set or initialization failed"
        }

    try:
        # 簡単な接続テスト
        db.collection("_test").limit(1).get()
        return {
            "status": "connected",
            "project_id": PROJECT_ID,
            "database_id": DATABASE_ID
        }
    except Exception as e:
        return {
            "status": "error",
            "project_id": PROJECT_ID,
            "database_id": DATABASE_ID,
            "error": str(e)
        }