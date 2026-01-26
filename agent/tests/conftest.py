"""Shared pytest fixtures for Claude E-Mart agent tests."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from server import app

    return TestClient(app)


@pytest.fixture
def sample_chat_request():
    """Sample chat request payload."""
    return {"message": "Hello, how are you?", "session_id": None}
