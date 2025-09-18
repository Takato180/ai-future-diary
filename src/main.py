from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .storage import router as storage_router
from .imagegen import router as image_router
from .textgen import router as text_router

app = FastAPI(
    title="Future Diary API",
    description="AI-powered future diary with Gemini text generation and Imagen illustration",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では Vercel ドメインに限定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def root():
    return {"message": "Future Diary API is alive"}

# ルーター登録
app.include_router(storage_router)

# AI機能ルーターの安全な登録
try:
    app.include_router(image_router)
    print("Image router registered successfully")
except Exception as e:
    print(f"Failed to register image router: {e}")

try:
    app.include_router(text_router)
    print("Text router registered successfully")
except Exception as e:
    print(f"Failed to register text router: {e}")
