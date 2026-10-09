"""Pytest test fixtures and configuration."""

import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient

# Set test environment variables before importing app
os.environ["ENVIRONMENT"] = "testing"
os.environ["DEV_BYPASS_AUTH"] = "True"
os.environ["FIREBASE_CREDENTIALS_PATH"] = "non-existent-file.json"

from app.main import create_app
from app.services import firebase_service
from app.services.firebase_service import InMemoryDatabaseService, get_database_service


@pytest.fixture(autouse=True)
def reset_in_memory_db() -> Generator[InMemoryDatabaseService, None, None]:
    """Provide a fresh in-memory database for every test function."""
    fresh_db = InMemoryDatabaseService()
    firebase_service._db_instance = fresh_db
    yield fresh_db
    firebase_service._db_instance = None


@pytest.fixture
def client(reset_in_memory_db) -> Generator[TestClient, None, None]:
    """TestClient fixture for making API requests."""
    app = create_app()
    app.dependency_overrides[get_database_service] = lambda: reset_in_memory_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
