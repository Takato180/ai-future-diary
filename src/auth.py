from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
import os
from datetime import datetime, timedelta

from .db import (
    UserCreate,
    UserLogin,
    UserResponse,
    create_user,
    authenticate_user,
    get_user,
    generate_user_cover,
    update_user_cover
)
from .imagegen import generate_image

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)

# JWT設定
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "ai-future-diary-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1週間

def create_access_token(user_id: str) -> str:
    """JWTトークンを生成"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[str]:
    """JWTトークンを検証してuser_idを返す"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except jwt.PyJWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[str]:
    """現在のユーザーを取得（任意）"""
    if not credentials:
        return None

    user_id = verify_token(credentials.credentials)
    return user_id

async def get_current_user_required(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """現在のユーザーを取得（必須）"""
    if not credentials:
        raise HTTPException(status_code=401, detail="認証が必要です")

    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="無効なトークンです")

    return user_id

@router.post("/register")
async def register_user(user_create: UserCreate):
    """新規ユーザー登録"""
    try:
        # ユーザー作成
        user = await create_user(user_create)

        # 表紙画像生成
        cover_prompt = await generate_user_cover(user.userName)

        try:
            # 画像生成リクエストオブジェクトを作成
            from .imagegen import ImageGenerateRequest

            image_request = ImageGenerateRequest(
                prompt=cover_prompt,
                style="watercolor",
                aspect_ratio="4:3"
            )

            # 画像生成
            cover_result = await generate_image(image_request)

            # 表紙画像URLを更新
            await update_user_cover(user.userId, cover_result.public_url)
            user.coverImageUrl = cover_result.public_url
        except Exception as e:
            print(f"Cover image generation failed: {e}")

        # JWTトークンを生成
        access_token = create_access_token(user.userId)

        return {
            "user": user,
            "access_token": access_token,
            "token_type": "bearer"
        }

    except Exception as e:
        if "既に使用されています" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="ユーザー登録に失敗しました")

@router.post("/login")
async def login_user(user_login: UserLogin):
    """ユーザーログイン"""
    try:
        user = await authenticate_user(user_login)
        if not user:
            raise HTTPException(status_code=401, detail="ユーザー名またはあいことばが間違っています")

        # JWTトークンを生成
        access_token = create_access_token(user.userId)

        return {
            "user": user,
            "access_token": access_token,
            "token_type": "bearer"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="ログインに失敗しました")

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user_id: str = Depends(get_current_user_required)):
    """現在のユーザー情報を取得"""
    user = await get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    return user

@router.post("/regenerate-cover")
async def regenerate_cover(user_id: str = Depends(get_current_user_required)):
    """表紙画像を再生成"""
    try:
        # ユーザー情報を取得
        user = await get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

        # 表紙画像を再生成
        cover_prompt = await generate_user_cover(user.userName)

        from .imagegen import ImageGenerateRequest
        image_request = ImageGenerateRequest(
            prompt=cover_prompt,
            style="watercolor",
            aspect_ratio="4:3"
        )

        cover_result = await generate_image(image_request)

        # 表紙画像URLを更新
        await update_user_cover(user_id, cover_result.public_url)

        return {
            "coverImageUrl": cover_result.public_url,
            "message": "表紙画像を更新しました"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="表紙画像の再生成に失敗しました")