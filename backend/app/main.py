"""FastAPI application factory, CORS configuration, and route registration."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import games, stats
from app.services.firebase_service import initialize_firebase

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("numbers_guesser.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan event handler for application startup and shutdown."""
    settings = get_settings()
    logger.info(f"Starting {settings.APP_NAME} in '{settings.ENVIRONMENT}' environment...")
    # Initialize DB (Firestore, Emulator, or In-Memory fallback)
    initialize_firebase()
    yield
    logger.info("Shutting down application...")


def create_app() -> FastAPI:
    """FastAPI application factory."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        description="High-performance Numbers Guesser API with Firebase Authentication & Firestore",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS Middleware Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health Check Endpoint (Required for Cloud Run)
    @app.get("/health", tags=["system"])
    async def health_check() -> dict:
        """Health check endpoint for Cloud Run and uptime monitoring."""
        return {"status": "healthy"}

    # Include API Routers
    app.include_router(games.router)
    app.include_router(stats.router)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
