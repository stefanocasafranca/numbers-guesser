"""Authentication dependencies for verifying Firebase ID tokens with local development bypass."""

import logging
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.schemas.game import AuthenticatedUser
from app.services.firebase_service import verify_firebase_token

logger = logging.getLogger("numbers_guesser.auth")
settings = get_settings()

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_dev_user_id: Optional[str] = Header(None, alias="X-Dev-User-ID"),
) -> AuthenticatedUser:
    """
    Authenticate request via Firebase ID Token Bearer header.
    Supports local dev bypass if unauthenticated or when DEV_BYPASS_AUTH is enabled.
    """
    # 1. Check for provided Bearer token
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        token = credentials.credentials.strip()

        # Mock token handling for local development/testing
        if token.startswith("test-") or token.startswith("dev-") or token == "mock-token":
            uid = x_dev_user_id or token
            return AuthenticatedUser(
                uid=uid,
                email=f"{uid}@test.local",
                display_name=f"Player {uid}",
            )

        # Real Firebase token verification
        try:
            decoded = verify_firebase_token(token)
            uid = decoded.get("uid") or decoded.get("user_id")
            if not uid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload: missing user ID",
                )
            return AuthenticatedUser(
                uid=uid,
                email=decoded.get("email"),
                display_name=decoded.get("name"),
            )
        except HTTPException:
            raise
        except Exception as err:
            logger.warning(f"Firebase token verification failed: {err}")
            # If dev bypass enabled, fall back gracefully
            if settings.DEV_BYPASS_AUTH or settings.ENVIRONMENT == "development":
                logger.info("Dev bypass fallback applied following token verification failure.")
                return AuthenticatedUser(
                    uid=x_dev_user_id or settings.DEV_DEFAULT_USER_ID,
                    email=settings.DEV_DEFAULT_USER_EMAIL,
                    display_name="Dev Player",
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
            )

    # 2. No Bearer token provided
    # Allow development / emulator bypass
    if settings.DEV_BYPASS_AUTH or settings.ENVIRONMENT == "development" or settings.FIRESTORE_EMULATOR_HOST:
        dev_uid = x_dev_user_id or settings.DEV_DEFAULT_USER_ID
        return AuthenticatedUser(
            uid=dev_uid,
            email=settings.DEV_DEFAULT_USER_EMAIL,
            display_name="Dev Player",
        )

    # In production without token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid Bearer token.",
    )
