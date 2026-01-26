"""Tests for the FastAPI server endpoints."""


def test_health_endpoint(client):
    """Test the health check endpoint returns OK."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_root_returns_404(client):
    """Test that root path returns 404 (no route defined)."""
    response = client.get("/")
    assert response.status_code == 404


def test_sessions_endpoint_returns_list(client):
    """Test the sessions endpoint returns a list."""
    response = client.get("/api/sessions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
