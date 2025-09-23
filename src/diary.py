from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, timedelta
from .db import (
    DiaryEntryCreate,
    DiaryEntryResponse,
    save_diary_entry,
    get_diary_entry,
    get_diary_entries_by_month,
    generate_diff_summary,
    get_firestore_status,
    get_diary_entries_by_year,
    get_user
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

        print(f"[DIARY] get_entry called: date={date}, current_user_id={current_user_id}, query_user_id={user_id}, effective_user_id={effective_user_id}")

        entry = await get_diary_entry(effective_user_id, date)

        print(f"[DIARY] get_entry result: entry_found={entry is not None}")
        if entry:
            print(f"[DIARY] Entry details: userId={entry.userId}, date={entry.date}, has_planText={bool(entry.planText)}, has_actualText={bool(entry.actualText)}")

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

        print(f"[DIARY] get_entries_by_year called: year={year}, current_user_id={current_user_id}, query_user_id={user_id}, effective_user_id={effective_user_id}")

        # 年の全月を取得
        all_entries = []
        for month in range(1, 13):
            month_str = f"{year:04d}-{month:02d}"
            try:
                entries = await get_diary_entries_by_month(effective_user_id, month_str)
                all_entries.extend(entries)
                if entries:
                    print(f"[DIARY] Found {len(entries)} entries for {month_str}")
            except Exception as e:
                print(f"[DIARY] Failed to get entries for {month_str}: {e}")
                continue

        print(f"[DIARY] get_entries_by_year result: total_entries={len(all_entries)} for user {effective_user_id}")
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

def _check_consecutive_days(entries: List[DiaryEntryResponse], target_days: int = 7) -> Optional[List[str]]:
    """連続記録日数をチェック"""
    if len(entries) < target_days:
        return None

    # 日付でソート（最新順）
    sorted_entries = sorted(entries, key=lambda x: x.date, reverse=True)

    # 実際のテキストが入力されているエントリのみを対象
    valid_entries = [e for e in sorted_entries if e.actualText and e.actualText.strip()]

    if len(valid_entries) < target_days:
        return None

    # 連続する日付かチェック
    for i in range(target_days - 1):
        current_date = datetime.strptime(valid_entries[i].date, "%Y-%m-%d").date()
        next_date = datetime.strptime(valid_entries[i + 1].date, "%Y-%m-%d").date()

        if (current_date - next_date).days != 1:
            return None

    # 連続する7日間の日付を返す
    return [entry.date for entry in valid_entries[:target_days]]

def _calculate_current_streak(entries: List[DiaryEntryResponse]) -> int:
    """現在の連続記録日数を計算（改善版）"""
    if not entries:
        return 0

    # 実際のテキストが入力されているエントリのみを対象にして日付順でソート
    valid_entries = [e for e in entries if e.actualText and e.actualText.strip()]
    if not valid_entries:
        return 0
    
    valid_entries = sorted(valid_entries, key=lambda x: x.date, reverse=True)
    
    today = datetime.now().date()
    current_streak = 0
    
    # 最新の記録日から開始
    latest_entry_date = datetime.strptime(valid_entries[0].date, "%Y-%m-%d").date()
    
    # 今日の記録があるか、昨日の記録があるかをチェック
    if latest_entry_date == today:
        # 今日の記録がある場合：今日から遡って計算
        start_date = today
    elif latest_entry_date == today - timedelta(days=1):
        # 昨日の記録がある場合（今日はまだ記録していない）：昨日から遡って計算
        start_date = latest_entry_date
    else:
        # 最新の記録が2日以上前の場合：ストリークは途切れている
        return 0
    
    # 連続記録日数を計算
    for i, entry in enumerate(valid_entries):
        entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
        expected_date = start_date - timedelta(days=i)
        
        if entry_date == expected_date:
            current_streak += 1
        else:
            break
    
    return current_streak

def _find_all_seven_day_streaks(entries: List[DiaryEntryResponse], user_registration_date: datetime) -> List[dict]:
    """登録日以降の全ての7日連続記録を検索（ハッカソン対応版）"""
    if not entries:
        return []
    
    # 実際のテキストが入力されているエントリのみを対象
    valid_entries = [e for e in entries if e.actualText and e.actualText.strip()]
    if not valid_entries:
        return []
    
    # 日付でソート（古い順）
    valid_entries = sorted(valid_entries, key=lambda x: x.date)
    
    # 登録日以降のエントリのみを対象
    registration_date = user_registration_date.date()
    valid_entries = [e for e in valid_entries if datetime.strptime(e.date, "%Y-%m-%d").date() >= registration_date]
    
    print(f"[STREAK DEBUG] Valid entries after registration filter: {len(valid_entries)}")
    print(f"[STREAK DEBUG] Dates: {[e.date for e in valid_entries]}")
    
    if len(valid_entries) < 7:
        print(f"[STREAK DEBUG] Not enough entries for 7-day streak")
        return []
    
    streaks = []
    start_idx = 0
    
    # すべての可能な7日間の組み合わせをチェック
    while start_idx <= len(valid_entries) - 7:
        # 7日連続かチェック
        is_consecutive = True
        streak_dates = []
        
        for j in range(7):
            current_entry = valid_entries[start_idx + j]
            current_date = datetime.strptime(current_entry.date, "%Y-%m-%d").date()
            streak_dates.append(current_entry.date)
            
            if j > 0:
                prev_date = datetime.strptime(valid_entries[start_idx + j - 1].date, "%Y-%m-%d").date()
                if (current_date - prev_date).days != 1:
                    is_consecutive = False
                    break
        
        if is_consecutive:
            # 7日連続を発見
            streak_info = {
                "start_date": streak_dates[0],
                "end_date": streak_dates[6],
                "dates": streak_dates,
                "completed_at": streak_dates[6]  # 7日目の日付
            }
            streaks.append(streak_info)
            print(f"[STREAK DEBUG] Found 7-day streak: {streak_info}")
            
            # ハッカソン用：重複を避けるため7日分スキップ
            start_idx += 7
        else:
            start_idx += 1
    
    print(f"[STREAK DEBUG] Total streaks found: {len(streaks)}")
    return streaks

def _calculate_current_streak_with_resets(entries: List[DiaryEntryResponse], completed_streaks: List[dict]) -> int:
    """完了したストリークを考慮して現在のストリーク日数を計算（ハッカソン対応版）"""
    if not entries:
        return 0
    
    # 実際のテキストが入力されているエントリのみを対象
    valid_entries = [e for e in entries if e.actualText and e.actualText.strip()]
    if not valid_entries:
        return 0
    
    # 日付でソート（新しい順）
    valid_entries = sorted(valid_entries, key=lambda x: x.date, reverse=True)
    
    # 最後に完了したストリークの終了日を取得
    last_completed_date = None
    if completed_streaks:
        last_completed = max(completed_streaks, key=lambda x: x["completed_at"])
        last_completed_date = datetime.strptime(last_completed["completed_at"], "%Y-%m-%d").date()
        print(f"[STREAK DEBUG] Last completed streak end date: {last_completed_date}")
    
    # 完了したストリーク以降のエントリを対象とする
    current_entries = []
    for entry in valid_entries:
        entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
        if last_completed_date is None or entry_date > last_completed_date:
            current_entries.append(entry)
    
    print(f"[STREAK DEBUG] Entries after last completed streak: {len(current_entries)}")
    if current_entries:
        print(f"[STREAK DEBUG] Current entry dates: {[e.date for e in current_entries]}")
    
    if not current_entries:
        return 0
    
    # 最新の日付から遡って連続記録を計算
    current_streak = 1  # 最新のエントリは確実にカウント
    prev_date = datetime.strptime(current_entries[0].date, "%Y-%m-%d").date()
    
    print(f"[STREAK DEBUG] Starting from date: {prev_date}")
    
    for i in range(1, len(current_entries)):
        current_date = datetime.strptime(current_entries[i].date, "%Y-%m-%d").date()
        
        if (prev_date - current_date).days == 1:
            # 前日の記録がある（連続）
            current_streak += 1
            prev_date = current_date
            print(f"[STREAK DEBUG] Consecutive day found: {current_date}, streak now: {current_streak}")
        else:
            # 連続が途切れた
            print(f"[STREAK DEBUG] Break in streak at: {current_date}, gap: {(prev_date - current_date).days} days")
            break
    
    print(f"[STREAK DEBUG] Final current streak: {current_streak}")
    return current_streak

@router.get("/streak-check")
async def check_streak(
    current_user_id: Optional[str] = Depends(get_current_user)
):
    """7日間連続記録をチェック（登録日以降、7日達成でリセット方式）"""
    try:
        if not current_user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        # ユーザー情報を取得（登録日取得のため）
        user = await get_user(current_user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # 現在の年の全エントリを取得
        current_year = datetime.now().year
        entries = await get_diary_entries_by_year(current_user_id, current_year)

        # デバッグ用ログ
        valid_entries = [e for e in entries if e.actualText and e.actualText.strip()]
        print(f"[STREAK DEBUG] User: {current_user_id}")
        print(f"[STREAK DEBUG] Total entries: {len(entries)}")
        print(f"[STREAK DEBUG] Valid entries (with actualText): {len(valid_entries)}")
        print(f"[STREAK DEBUG] Valid entry dates: {[e.date for e in sorted(valid_entries, key=lambda x: x.date)]}")
        print(f"[STREAK DEBUG] Registration date: {user.createdAt.date()}")

        # 登録日以降の全ての7日連続記録を検索
        completed_streaks = _find_all_seven_day_streaks(entries, user.createdAt)
        print(f"[STREAK DEBUG] Completed streaks found: {len(completed_streaks)}")
        if completed_streaks:
            print(f"[STREAK DEBUG] Completed streaks details: {completed_streaks}")

        # 現在のストリーク日数を計算（完了したストリークを除外）
        current_streak = _calculate_current_streak_with_resets(entries, completed_streaks)
        print(f"[STREAK DEBUG] Current streak calculated: {current_streak}")

        return {
            "has_seven_day_streak": len(completed_streaks) > 0,
            "completed_streaks_count": len(completed_streaks),
            "completed_streaks": completed_streaks,
            "latest_completed_streak": completed_streaks[-1] if completed_streaks else None,
            "current_streak": current_streak,
            "total_entries": len([e for e in entries if e.actualText and e.actualText.strip()]),
            "needed_for_seven": max(0, 7 - current_streak),
            "registration_date": user.createdAt.date().isoformat(),
            # デバッグ情報も追加
            "debug": {
                "total_entries": len(entries),
                "valid_entries": len(valid_entries),
                "valid_entry_dates": [e.date for e in sorted(valid_entries, key=lambda x: x.date)],
                "registration_date": user.createdAt.date().isoformat()
            }
        }

    except Exception as e:
        print(f"[STREAK ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check streak: {str(e)}")