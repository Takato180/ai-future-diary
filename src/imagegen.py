import os
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.cloud import storage as gcs
from google.cloud import aiplatform
from vertexai.preview.vision_models import ImageGenerationModel
import vertexai

router = APIRouter(prefix="/image", tags=["image"])

PROJECT_ID = os.environ.get("PROJECT_ID")
BUCKET_NAME = os.environ.get("BUCKET_NAME")
VERTEX_LOCATION = os.environ.get("VERTEX_LOCATION", "us-central1")
IMAGEN_MODEL = os.environ.get("IMAGEN_MODEL", "imagen-3.0-generate-001")

# Vertex AI 初期化
if PROJECT_ID and VERTEX_LOCATION:
    vertexai.init(project=PROJECT_ID, location=VERTEX_LOCATION)

class ImageGenerateRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    style: str | None = None
    aspect_ratio: str = "1:1"

class ImageGenerateResponse(BaseModel):
    path: str
    public_url: str | None = None
    signed_url: str | None = None

def _get_storage_client():
    return gcs.Client(project=PROJECT_ID)

def _upload_to_gcs(image_bytes: bytes, object_path: str, content_type: str = "image/png") -> str:
    """画像をGCSにアップロードして、オブジェクトパスを返す"""
    client = _get_storage_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(object_path)
    
    blob.upload_from_string(image_bytes, content_type=content_type)
    return object_path

def _generate_signed_url(object_path: str) -> str:
    """署名付きGET URLを生成"""
    from datetime import timedelta
    
    client = _get_storage_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(object_path)
    
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(hours=1),
        method="GET"
    )
    return url

@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(request: ImageGenerateRequest):
    """
    Vertex AI Imagen 3を使用して画像を生成し、GCSに保存
    """
    if not PROJECT_ID:
        raise HTTPException(500, "PROJECT_ID is not set")
    if not BUCKET_NAME:
        raise HTTPException(500, "BUCKET_NAME is not set")
    
    try:
        # Imagen モデル初期化
        model = ImageGenerationModel.from_pretrained(IMAGEN_MODEL)
        
        # プロンプトにスタイル情報を追加
        enhanced_prompt = request.prompt
        if request.style:
            enhanced_prompt = f"{request.prompt}, {request.style} style"
        
        # 画像生成
        images = model.generate_images(
            prompt=enhanced_prompt,
            number_of_images=1,
            aspect_ratio=request.aspect_ratio,
            safety_filter_level="block_some",
            person_generation="allow_adult"
        )
        
        if not images:
            raise HTTPException(500, "No images generated")
        
        # 生成された画像を取得
        generated_image = images[0]
        image_bytes = generated_image._image_bytes
        
        # GCSにアップロード用のパスを生成
        unique_id = str(uuid.uuid4())
        object_path = f"generated/{unique_id}.png"
        
        # GCSにアップロード
        _upload_to_gcs(image_bytes, object_path, "image/png")
        
        # 署名付きURLを生成
        signed_url = _generate_signed_url(object_path)
        
        return ImageGenerateResponse(
            path=object_path,
            signed_url=signed_url
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@router.get("/styles")
def get_image_styles():
    """利用可能な画像スタイル一覧"""
    return {
        "styles": [
            "watercolor",
            "oil painting", 
            "crayon drawing",
            "pencil sketch",
            "digital art",
            "anime style",
            "realistic photo",
            "impressionist",
            "minimalist"
        ]
    }