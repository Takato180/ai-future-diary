# src/storage.py
import os
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from starlette.responses import StreamingResponse
from google.cloud import storage as gcs
# IAM Signer for Cloud Run
from google.auth import compute_engine, iam
from google.auth.transport.requests import Request

router = APIRouter(prefix="/storage", tags=["storage"])

PROJECT_ID = os.environ.get("PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "ai-future-diary")

def _client():
    return gcs.Client(project=PROJECT_ID)

def _get_iam_signer():
    """Cloud Run環境でIAM Signerを取得"""
    try:
        # Cloud Runのメタデータ認証情報を取得
        base_creds = compute_engine.Credentials()
        # サービスアカウントのメールアドレスを取得
        sa_email = base_creds.service_account_email
        # IAM Signerを作成
        signer = iam.Signer(Request(), base_creds, sa_email)
        return signer
    except Exception as e:
        print(f"IAM Signer creation failed: {e}")
        return None

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

    try:
        client = _client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(object_path)

        # IAM Signerを使用
        signer = _get_iam_signer()
        if not signer:
            raise HTTPException(500, "Failed to create IAM signer")

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=expires_sec),
            method=method,
            content_type=content_type if method == "PUT" else None,
            credentials=signer,
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

        # Make the uploaded file publicly accessible (same as image generation)
        blob.make_public()

        # Generate public URL for accessing the uploaded file
        public_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{object_path}"

        # Try to generate signed URL with IAM Signer for backup access
        signed_url = public_url  # fallback to public URL
        try:
            signer = _get_iam_signer()
            if signer:
                signed_url = blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(hours=24),
                    method="GET",
                    credentials=signer,
                )
        except Exception as e:
            print(f"Failed to generate signed URL, using public URL: {e}")

        return {
            "path": object_path,
            "content_type": file.content_type,
            "signed_url": signed_url,
            "public_url": public_url
        }
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
