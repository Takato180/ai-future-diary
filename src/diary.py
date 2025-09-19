from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from .db import (
    DiaryEntryCreate,
    DiaryEntryResponse,
    save_diary_entry,
    get_diary_entry,
    get_diary_entries_by_month,
    generate_diff_summary,
    get_firestore_status
)

router = APIRouter(prefix="/diary", tags=["diary"])

@router.get("/status")
def get_status():
    """Firestore接続状態を確認"""
    return get_firestore_status()

@router.post("/entries/{date}", response_model=DiaryEntryResponse)
async def save_entry(
    date: str,
    entry: DiaryEntryCreate
):
    """
    日記エントリを保存・更新

    Args:
        date: YYYY-MM-DD形式の日付
        entry: 日記エントリデータ
    """
    try:
        # 日付フォーマットチェック
        datetime.strptime(date, "%Y-%m-%d")

        # entry.dateをURLパラメータの値で上書き
        entry.date = date

        saved_entry = await save_diary_entry(entry)
        return DiaryEntryResponse(**saved_entry.model_dump())

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@router.get("/entries/{date}", response_model=Optional[DiaryEntryResponse])
async def get_entry(
    date: str,
    user_id: str = Query(default="anonymous", description="User ID")
):
    """
    特定の日の日記エントリを取得

    Args:
        date: YYYY-MM-DD形式の日付
        user_id: ユーザーID（デフォルト: anonymous）
    """
    try:
        # 日付フォーマットチェック
        datetime.strptime(date, "%Y-%m-%d")

        entry = await get_diary_entry(user_id, date)
        return entry

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get entry: {str(e)}")

@router.get("/entries", response_model=List[DiaryEntryResponse])
async def get_entries_by_month(
    month: str = Query(..., description="YYYY-MM format"),
    user_id: str = Query(default="anonymous", description="User ID")
):
    """
    指定月の日記エントリ一覧を取得（カレンダー表示用）

    Args:
        month: YYYY-MM形式の年月
        user_id: ユーザーID（デフォルト: anonymous）
    """
    try:
        # 月フォーマットチェック
        datetime.strptime(f"{month}-01", "%Y-%m-%d")

        entries = await get_diary_entries_by_month(user_id, month)
        return entries

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get entries: {str(e)}")

@router.post("/entries/{date}/diff")
async def create_diff_summary(
    date: str,
    user_id: str = Query(default="anonymous", description="User ID")
):
    """
    予定と実際の差分要約を生成

    Args:
        date: YYYY-MM-DD形式の日付
        user_id: ユーザーID（デフォルト: anonymous）
    """
    try:
        # 日付フォーマットチェック
        datetime.strptime(date, "%Y-%m-%d")

        # エントリを取得
        entry = await get_diary_entry(user_id, date)
        if not entry:
            raise HTTPException(status_code=404, detail="Diary entry not found")

        if not entry.planText or not entry.actualText:
            raise HTTPException(
                status_code=400,
                detail="Both planText and actualText are required for diff generation"
            )

        # 差分要約を生成
        diff_text = await generate_diff_summary(
            user_id, date, entry.planText, entry.actualText
        )

        return {
            "date": date,
            "userId": user_id,
            "diffText": diff_text
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate diff: {str(e)}")

@router.get("/test")
async def test_connection():
    """接続テスト用エンドポイント"""
    try:
        status = get_firestore_status()

        # 簡単なCRUDテスト
        if status["status"] == "connected":
            test_entry = DiaryEntryCreate(
                userId="test",
                date="2025-01-01",
                planText="テスト予定",
                actualText="テスト実際"
            )

            # 保存テスト
            saved = await save_diary_entry(test_entry)

            # 取得テスト
            retrieved = await get_diary_entry("test", "2025-01-01")

            return {
                "status": "success",
                "firestore": status,
                "test_result": {
                    "saved": saved.model_dump() if saved else None,
                    "retrieved": retrieved.model_dump() if retrieved else None
                }
            }
        else:
            return {
                "status": "firestore_not_available",
                "firestore": status
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }