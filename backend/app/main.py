from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes import auth, vocab
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
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

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "groq_mocked": settings.is_groq_mocked,
        "tts_mocked": settings.is_tts_mocked,
        "r2_mocked": settings.is_r2_mocked
    }

