from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, memories, ai, storage, categories, preferences, insights, decisions
from app.database import init_db
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    await init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Memory AI API",
    description="Backend API for Memory AI - Your personal memory companion",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


def _get_cors_origins() -> list[str]:
    raw = settings.BACKEND_CORS_ORIGINS.strip()
    if not raw:
        return []
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(memories.router, prefix="/memories", tags=["Memories"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])
app.include_router(storage.router, prefix="/storage", tags=["Storage"])
app.include_router(categories.router, prefix="/categories", tags=["Categories"])
app.include_router(preferences.router, prefix="/preferences", tags=["Preferences"])
app.include_router(insights.router, prefix="/insights", tags=["Insights"])
app.include_router(decisions.router, prefix="/decisions", tags=["Decisions"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Memory AI API", "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
