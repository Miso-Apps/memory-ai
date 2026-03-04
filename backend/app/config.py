from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    APP_NAME: str = "Memory AI"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://memoryai:dev_password_change_me@localhost:5432/memoryai"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIM: int = 1536  # Reduced from 3072 for pgvector index compatibility
    
    # S3/MinIO Storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "memory-ai"
    S3_REGION: str = "us-east-1"
    
    # Whisper (for audio transcription)
    WHISPER_MODEL: str = "whisper-1"
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # Vector Database
    USE_PINECONE: bool = False  # If True, use Pinecone; if False, use pgvector
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    PINECONE_INDEX_NAME: Optional[str] = "memory-ai"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
