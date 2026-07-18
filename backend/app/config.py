import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "Language Learner API"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@db:5432/langapp"
    )
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-temporary-key-for-local-dev")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # AI & Services (fall back to mock mode if key is missing)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    
    # OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    # Storage
    CLOUDFLARE_R2_BUCKET: str = os.getenv("CLOUDFLARE_R2_BUCKET", "")
    CLOUDFLARE_R2_ACCESS_KEY: str = os.getenv("CLOUDFLARE_R2_ACCESS_KEY", "")
    CLOUDFLARE_R2_SECRET_KEY: str = os.getenv("CLOUDFLARE_R2_SECRET_KEY", "")
    CLOUDFLARE_R2_ENDPOINT: str = os.getenv("CLOUDFLARE_R2_ENDPOINT", "")

    @property
    def is_groq_mocked(self) -> bool:
        return not self.GROQ_API_KEY


    @property
    def is_r2_mocked(self) -> bool:
        return not (self.CLOUDFLARE_R2_ACCESS_KEY and self.CLOUDFLARE_R2_SECRET_KEY)

settings = Settings()
