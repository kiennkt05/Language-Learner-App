import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes import auth, vocab, ai_explain, srs, stats
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dynamic check/alter to add tier if missing (saves Postgres docker drop container recreations)
    try:
        from app.db.session import engine
        from sqlalchemy import text
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'premium'"))
            conn.execute(text("ALTER TABLE vocab_lists ADD COLUMN IF NOT EXISTS target_language VARCHAR"))
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
        "r2_mocked": settings.is_r2_mocked
    }

