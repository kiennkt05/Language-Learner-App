import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.routes import auth, vocab, ai_explain, srs, stats
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dynamic check/alter to add audio_url if missing (saves Postgres docker drop container recreations)
    try:
        from app.db.session import engine
        from sqlalchemy import text
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE words ADD COLUMN IF NOT EXISTS audio_url VARCHAR"))
    except Exception as e:
        print(f"Database column auto-alter check skipped/failed: {e}")

    # Proactively create tables on startup if database is accessible
    try:
        from app.db.session import engine, Base
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Database table creation skipped on startup: {e}")
    yield

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Mount local cache folder static/audio as StaticFiles
os_static_dir = "static"
os.makedirs(os_static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=os_static_dir), name="static")

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth.router)
app.include_router(vocab.router)
app.include_router(ai_explain.router)
app.include_router(srs.router)
app.include_router(stats.router)

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "groq_mocked": settings.is_groq_mocked,
        "tts_mocked": settings.is_tts_mocked,
        "r2_mocked": settings.is_r2_mocked
    }

