from fastapi import FastAPI
from .storage import router as storage_router

app = FastAPI()

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def root():
    return {"message": "Future Diary API is alive"}

app.include_router(storage_router)
