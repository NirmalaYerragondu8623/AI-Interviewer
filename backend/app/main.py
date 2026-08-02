from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import question_bank, sessions

app = FastAPI(title="AI Interview App API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(question_bank.router)
app.include_router(sessions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
