# src/storage.py
import os
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from starlette.responses import StreamingResponse
from google.cloud import storage as gcs
# 署名付きURL（GET/PUT）
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request
from google.auth.iam import Signer

router = APIRouter(prefix="/storage", tags=["storage"])

PROJECT_ID = os.environ.get("PROJECT_ID")
BUCKET_NAME = os.environ.get("BUCKET_NAME")
SERVICE_ACCOUNT_EMAIL = os.environ.get("SERVICE_ACCOUNT_EMAIL")  # 署名URL用

def _client():
    return gcs.Client(project=PROJECT_ID)

# ---- 署名付きURL（GET/PUT） ----
@router.get("/signed-url")
def get_signed_url(
    object_path: str = Query(..., description="例: uploads/sample.png"),
    method: str = Query("GET", pattern="^(GET|PUT)$"),
    expires_sec: int = 600,
    content_type: str | None = None,
):
    if not BUCKET_NAME:
        raise HTTPException(500, "BUCKET_NAME is not set")
    if not SERVICE_ACCOUNT_EMAIL:
        raise HTTPException(500, "SERVICE_ACCOUNT_EMAIL is not set")

    try:
        client = _client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(object_path)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=expires_sec),
            method=method,
            content_type=content_type if method == "PUT" else None,
            service_account_email=SERVICE_ACCOUNT_EMAIL,  # IAM に委譲
        )
        return {"signed_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---- サーバー経由アップロード ----
@router.post("/upload")
async def upload_file(
    object_path: str = Query(..., description="例: uploads/123.png"),
    file: UploadFile = File(...),
):
    if not BUCKET_NAME:
        raise HTTPException(500, "BUCKET_NAME is not set")
    try:
        client = _client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(object_path)
        blob.upload_from_file(file.file, content_type=file.content_type)
        return {"path": object_path, "content_type": file.content_type}
    except Exception as e:
        raise HTTPException(500, str(e))

# ---- サーバー経由ストリーム配信 ----
@router.get("/stream")
def stream_file(object_path: str = Query(...)):
    if not BUCKET_NAME:
        raise HTTPException(500, "BUCKET_NAME is not set")
    try:
        client = _client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(object_path)
        if not blob.exists():
            raise HTTPException(404, "object not found")
        f = blob.open("rb")
        return StreamingResponse(f, media_type=blob.content_type or "application/octet-stream")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
