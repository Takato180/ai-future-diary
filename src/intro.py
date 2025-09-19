# src/intro.py
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user

router = APIRouter(prefix="/intro", tags=["intro"])

DEFAULT_URL = os.getenv("DEFAULT_INTRO_VIDEO_URL", "https://storage.googleapis.com/ai-future-diary/default_login.mp4")
VERSION = int(os.getenv("INTRO_VIDEO_VERSION", "1"))

class SeenPayload(BaseModel):
    opted_out: bool = False  # 次回以降スキップ

@router.get("/config")
def get_intro_config():
    """イントロ動画の設定を取得"""
    if not DEFAULT_URL:
        raise HTTPException(500, "DEFAULT_INTRO_VIDEO_URL missing")
    return {
        "url": DEFAULT_URL,
        "version": VERSION,
    }

@router.post("/seen")
def mark_intro_seen(payload: SeenPayload, user_id: Optional[str] = Depends(get_current_user)):
    """イントロ動画の視聴を記録"""
    # 将来 Firestore に保存する想定。とりあえず成功レスポンスを返す
    # 例: users/{uid}/meta.intro = { seen_version: VERSION, opted_out, last_shown_at }
    return {
        "ok": True,
        "saved": {
            "user_id": user_id or "anonymous",
            "seen_version": VERSION,
            "opted_out": payload.opted_out,
            "ts": datetime.now(timezone.utc).isoformat()
        }
    }