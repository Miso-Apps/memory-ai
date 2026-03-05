from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, memories, ai, storage, categories, preferences, insights
from app.database import init_db


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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
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


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Memory AI API", "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
