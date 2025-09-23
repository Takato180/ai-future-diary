from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .storage import router as storage_router

print("=== Loading AI routers ===")
try:
    from .imagegen import router as image_router
    print("OK Image router loaded successfully")
except Exception as e:
    print(f"ERROR Image router failed: {e}")
    image_router = None

try:
    from .textgen import router as text_router
    print("OK Text router loaded successfully")
except Exception as e:
    print(f"ERROR Text router failed: {e}")
    text_router = None

try:
    from .diary import router as diary_router
    print("OK Diary router loaded successfully")
except Exception as e:
    print(f"ERROR Diary router failed: {e}")
    diary_router = None

try:
    from .auth import router as auth_router
    print("OK Auth router loaded successfully")
except Exception as e:
    print(f"ERROR Auth router failed: {e}")
    auth_router = None

try:
    from .intro import router as intro_router
    print("OK Intro router loaded successfully")
except Exception as e:
    print(f"ERROR Intro router failed: {e}")
    intro_router = None

try:
    from .videogen import router as video_router
    print("OK Video router loaded successfully")
except Exception as e:
    print(f"ERROR Video router failed: {e}")
    video_router = None

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
    return {
        "message": "Future Diary API is alive", 
        "version": "1.0.0",
        "timestamp": "2025-09-18-gemini-fix"
    }

# ルーター登録
app.include_router(storage_router)

# AI機能ルーターの安全な登録
print("=== Registering routers ===")

if image_router:
    try:
        app.include_router(image_router)
        print("OK Image router registered successfully")
    except Exception as e:
        print(f"ERROR Failed to register image router: {e}")
else:
    print("ERROR Image router not available")

if text_router:
    try:
        app.include_router(text_router)
        print("OK Text router registered successfully")
    except Exception as e:
        print(f"ERROR Failed to register text router: {e}")
else:
    print("ERROR Text router not available")

if diary_router:
    try:
        app.include_router(diary_router)
        print("OK Diary router registered successfully")
    except Exception as e:
        print(f"ERROR Failed to register diary router: {e}")
else:
    print("ERROR Diary router not available")

if auth_router:
    try:
        app.include_router(auth_router)
        print("OK Auth router registered successfully")
    except Exception as e:
        print(f"ERROR Failed to register auth router: {e}")
else:
    print("ERROR Auth router not available")

if intro_router:
    try:
        app.include_router(intro_router)
        print("OK Intro router registered successfully")
    except Exception as e:
        print(f"ERROR Failed to register intro router: {e}")
else:
    print("ERROR Intro router not available")

if video_router:
    try:
        app.include_router(video_router)
        print("OK Video router registered successfully")
    except Exception as e:
        print(f"ERROR Failed to register video router: {e}")
else:
    print("ERROR Video router not available")

print("=== App startup complete ===")
print(f"App title: {app.title}")
print(f"Available routes: {len(app.routes)}")
