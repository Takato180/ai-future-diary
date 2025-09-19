import os
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