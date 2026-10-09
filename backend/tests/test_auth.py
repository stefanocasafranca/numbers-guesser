"""Unit tests for authentication dependency and fallback modes."""

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.config import Settings
from app.dependencies import get_current_user


@pytest.mark.asyncio
async def test_auth_dev_bypass_unauthenticated(monkeypatch):
    """Test that when dev bypass is on and no token is provided, a default dev user is returned."""
    user = await get_current_user(credentials=None, x_dev_user_id=None)
    assert user.uid == "dev-player-1"
    assert user.email == "dev@numbersguesser.local"


@pytest.mark.asyncio
async def test_auth_dev_bypass_with_custom_header():
    """Test providing X-Dev-User-ID header returns that custom user."""
    user = await get_current_user(credentials=None, x_dev_user_id="custom-dev-user")
    assert user.uid == "custom-dev-user"
    assert user.display_name == "Dev Player"


@pytest.mark.asyncio
async def test_auth_mock_token_prefix():
    """Test tokens starting with 'test-' or 'dev-' return structured AuthenticatedUser."""
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-player-99")
    user = await get_current_user(credentials=creds, x_dev_user_id=None)
    assert user.uid == "test-player-99"
    assert user.email == "test-player-99@test.local"


@pytest.mark.asyncio
async def test_auth_production_rejection_without_token(monkeypatch):
    """Test that in production mode with dev bypass disabled, missing credentials raise 401."""
    test_settings = Settings(
        ENVIRONMENT="production",
        DEV_BYPASS_AUTH=False,
        FIRESTORE_EMULATOR_HOST=None,
    )
    monkeypatch.setattr("app.dependencies.settings", test_settings)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=None, x_dev_user_id=None)
    assert exc_info.value.status_code == 401
    assert "Authentication required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_auth_invalid_token_production(monkeypatch):
    """Test that invalid token in production raises 401."""
    test_settings = Settings(
        ENVIRONMENT="production",
        DEV_BYPASS_AUTH=False,
        FIRESTORE_EMULATOR_HOST=None,
    )
    monkeypatch.setattr("app.dependencies.settings", test_settings)

    def mock_verify_fail(token):
        raise ValueError("Signature verification failed")

    monkeypatch.setattr("app.dependencies.verify_firebase_token", mock_verify_fail)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token-xyz")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, x_dev_user_id=None)
    assert exc_info.value.status_code == 401
    assert "Invalid or expired authentication token" in exc_info.value.detail
