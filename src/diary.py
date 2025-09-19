from fastapi import APIRouter, HTTPException, Query, Depends
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
from .auth import get_current_user

router = APIRouter(prefix="/diary", tags=["diary"])

@router.get("/status")
def get_status():
    """Firestore接続状態を確認"""
    return get_firestore_status()

@router.post("/entries/{date}", response_model=DiaryEntryResponse)
async def save_entry(
    date: str,
    entry: DiaryEntryCreate,
    current_user_id: Optional[str] = Depends(get_current_user)
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

        # ユーザーIDを設定（認証済みの場合は現在のユーザー、未認証の場合はanonymous）
        entry.userId = current_user_id or "anonymous"

        saved_entry = await save_diary_entry(entry)
        return DiaryEntryResponse(**saved_entry.model_dump())

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@router.get("/entries/{date}", response_model=Optional[DiaryEntryResponse])
async def get_entry(
    date: str,
    current_user_id: Optional[str] = Depends(get_current_user),
    user_id: str = Query(default=None, description="User ID (optional)")
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

        # ユーザーIDを決定（認証済みの場合は現在のユーザーを優先、未認証の場合のみクエリパラメータかデフォルト値を使用）
        effective_user_id = current_user_id if current_user_id else (user_id or "anonymous")

        entry = await get_diary_entry(effective_user_id, date)
        return entry

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get entry: {str(e)}")

@router.get("/entries", response_model=List[DiaryEntryResponse])
async def get_entries_by_month(
    month: str = Query(..., description="YYYY-MM format"),
    current_user_id: Optional[str] = Depends(get_current_user),
    user_id: str = Query(default=None, description="User ID (optional)")
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

        # ユーザーIDを決定（認証済みの場合は現在のユーザーを優先、未認証の場合のみクエリパラメータかデフォルト値を使用）
        effective_user_id = current_user_id if current_user_id else (user_id or "anonymous")

        entries = await get_diary_entries_by_month(effective_user_id, month)
        return entries

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get entries: {str(e)}")

@router.get("/entries/year/{year}", response_model=List[DiaryEntryResponse])
async def get_entries_by_year(
    year: int,
    current_user_id: Optional[str] = Depends(get_current_user),
    user_id: str = Query(default=None, description="User ID (optional)")
):
    """
    指定年の日記エントリ一覧を取得（パフォーマンス最適化用）

    Args:
        year: 年（例: 2024）
        user_id: ユーザーID（デフォルト: anonymous）
    """
    try:
        # ユーザーIDを決定（認証済みの場合は現在のユーザーを優先、未認証の場合のみクエリパラメータかデフォルト値を使用）
        effective_user_id = current_user_id if current_user_id else (user_id or "anonymous")

        # 年の全月を取得
        all_entries = []
        for month in range(1, 13):
            month_str = f"{year:04d}-{month:02d}"
            try:
                entries = await get_diary_entries_by_month(effective_user_id, month_str)
                all_entries.extend(entries)
            except Exception as e:
                print(f"Failed to get entries for {month_str}: {e}")
                continue

        return all_entries

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get year entries: {str(e)}")

@router.post("/entries/{date}/diff")
async def create_diff_summary(
    date: str,
    current_user_id: Optional[str] = Depends(get_current_user),
    user_id: str = Query(default=None, description="User ID (optional)")
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

        # ユーザーIDを決定（認証済みの場合は現在のユーザーを優先、未認証の場合のみクエリパラメータかデフォルト値を使用）
        effective_user_id = current_user_id if current_user_id else (user_id or "anonymous")

        # エントリを取得
        entry = await get_diary_entry(effective_user_id, date)
        if not entry:
            raise HTTPException(status_code=404, detail="Diary entry not found")

        if not entry.planText or not entry.actualText:
            raise HTTPException(
                status_code=400,
                detail="Both planText and actualText are required for diff generation"
            )

        # 差分要約を生成
        diff_text = await generate_diff_summary(
            effective_user_id, date, entry.planText, entry.actualText
        )

        return {
            "date": date,
            "userId": effective_user_id,
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