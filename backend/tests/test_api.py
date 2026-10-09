"""Integration tests for all REST API endpoints."""

from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    """Test health check returns status healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_start_game_default(client: TestClient):
    """Test creating a game with default range (1-100)."""
    response = client.post("/api/v1/games")
    assert response.status_code == 201
    data = response.json()
    assert "game_id" in data
    assert data["min_range"] == 1
    assert data["max_range"] == 100
    assert data["status"] == "IN_PROGRESS"
    assert "started_at" in data


def test_start_game_custom_range(client: TestClient):
    """Test creating a game with custom min/max range."""
    response = client.post(
        "/api/v1/games",
        json={"min_range": 10, "max_range": 50},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["min_range"] == 10
    assert data["max_range"] == 50


def test_start_game_invalid_range(client: TestClient):
    """Test creating a game where min_range >= max_range returns validation error."""
    response = client.post(
        "/api/v1/games",
        json={"min_range": 100, "max_range": 50},
    )
    assert response.status_code == 422


def test_get_active_game_lifecycle(client: TestClient):
    """Test active game retrieval before and after starting."""
    # When no game has started
    res_none = client.get("/api/v1/games/active")
    assert res_none.status_code == 200
    assert res_none.json() is None

    # Start a game
    res_start = client.post("/api/v1/games")
    game_id = res_start.json()["game_id"]

    # Active game should now be returned
    res_active = client.get("/api/v1/games/active")
    assert res_active.status_code == 200
    active_data = res_active.json()
    assert active_data["game_id"] == game_id
    assert active_data["status"] == "IN_PROGRESS"
    assert active_data["attempts"] == 0
    assert active_data["past_guesses"] == []


def test_submit_guess_flow(client: TestClient, reset_in_memory_db):
    """Test full guessing lifecycle from start to win."""
    res_start = client.post("/api/v1/games", json={"min_range": 1, "max_range": 100})
    game_id = res_start.json()["game_id"]

    # Fetch secret target from test db directly
    game_data = reset_in_memory_db.get_game("dev-player-1", game_id)
    target = game_data["targetNumber"]

    # 1. Out of range guess
    res_oor = client.post(
        f"/api/v1/games/{game_id}/guess",
        json={"guess": 150},
    )
    assert res_oor.status_code == 400
    assert "between 1 and 100" in res_oor.json()["detail"]

    # 2. First incorrect guess
    first_guess = 1 if target > 1 else 100
    res_guess1 = client.post(
        f"/api/v1/games/{game_id}/guess",
        json={"guess": first_guess},
    )
    assert res_guess1.status_code == 200
    data1 = res_guess1.json()
    assert data1["game_id"] == game_id
    assert data1["guess"] == first_guess
    assert data1["attempts"] == 1
    assert data1["is_game_over"] is False
    assert data1["target_number"] is None
    assert len(data1["past_guesses"]) == 1
    assert data1["past_guesses"][0]["guess"] == first_guess

    # 3. Winning guess
    res_win = client.post(
        f"/api/v1/games/{game_id}/guess",
        json={"guess": target},
    )
    assert res_win.status_code == 200
    data_win = res_win.json()
    assert data_win["result"] == "CORRECT"
    assert data_win["attempts"] == 2
    assert data_win["is_game_over"] is True
    assert data_win["target_number"] == target
    assert "Congratulations" in data_win["message"]

    # 4. Attempting another guess on finished game should fail
    res_after = client.post(
        f"/api/v1/games/{game_id}/guess",
        json={"guess": target},
    )
    assert res_after.status_code == 400
    assert "already completed" in res_after.json()["detail"]


def test_forfeit_previous_game_on_new_start(client: TestClient):
    """Test starting a new game forfeits an active one."""
    res_game1 = client.post("/api/v1/games")
    game1_id = res_game1.json()["game_id"]

    # Start second game
    res_game2 = client.post("/api/v1/games")
    game2_id = res_game2.json()["game_id"]
    assert game1_id != game2_id

    # Active game should now be game 2
    res_active = client.get("/api/v1/games/active")
    assert res_active.json()["game_id"] == game2_id

    # History should contain both games, game1 marked FORFEIT
    res_history = client.get("/api/v1/games/history")
    games = res_history.json()["games"]
    assert len(games) == 2
    g1 = next(g for g in games if g["game_id"] == game1_id)
    assert g1["status"] == "FORFEIT"


def test_stats_and_history_endpoints(client: TestClient, reset_in_memory_db):
    """Test stats aggregation and history pagination."""
    # Play and win game 1
    res1 = client.post("/api/v1/games", json={"min_range": 1, "max_range": 10})
    g1_id = res1.json()["game_id"]
    g1_target = reset_in_memory_db.get_game("dev-player-1", g1_id)["targetNumber"]
    client.post(f"/api/v1/games/{g1_id}/guess", json={"guess": g1_target})

    # Stats should show 1 game, 1 win, streak 1, best_score 1
    res_stats1 = client.get("/api/v1/stats")
    assert res_stats1.status_code == 200
    stats1 = res_stats1.json()
    assert stats1["total_games"] == 1
    assert stats1["games_won"] == 1
    assert stats1["best_score"] == 1
    assert stats1["current_streak"] == 1

    # Play and win game 2 with 2 guesses
    res2 = client.post("/api/v1/games", json={"min_range": 1, "max_range": 10})
    g2_id = res2.json()["game_id"]
    g2_target = reset_in_memory_db.get_game("dev-player-1", g2_id)["targetNumber"]
    wrong_guess = 1 if g2_target > 1 else 10
    client.post(f"/api/v1/games/{g2_id}/guess", json={"guess": wrong_guess})
    client.post(f"/api/v1/games/{g2_id}/guess", json={"guess": g2_target})

    # Stats should update: total=2, won=2, streak=2, avg_guesses=1.5
    res_stats2 = client.get("/api/v1/stats")
    stats2 = res_stats2.json()
    assert stats2["total_games"] == 2
    assert stats2["games_won"] == 2
    assert stats2["current_streak"] == 2
    assert stats2["avg_guesses"] == 1.5

    # Check history pagination
    res_hist = client.get("/api/v1/games/history?page=1&limit=10")
    hist = res_hist.json()
    assert hist["total"] == 2
    assert len(hist["games"]) == 2


def test_user_isolation(client: TestClient):
    """Test that two different users have independent game states."""
    # User 1 starts a game
    headers_u1 = {"X-Dev-User-ID": "user-alpha"}
    headers_u2 = {"X-Dev-User-ID": "user-beta"}

    res_u1 = client.post("/api/v1/games", headers=headers_u1)
    g_u1_id = res_u1.json()["game_id"]

    # User 2 starts a game
    res_u2 = client.post("/api/v1/games", headers=headers_u2)
    g_u2_id = res_u2.json()["game_id"]

    # User 1's active game is g_u1_id
    active_u1 = client.get("/api/v1/games/active", headers=headers_u1).json()
    assert active_u1["game_id"] == g_u1_id

    # User 2's active game is g_u2_id
    active_u2 = client.get("/api/v1/games/active", headers=headers_u2).json()
    assert active_u2["game_id"] == g_u2_id


def test_pre_login_session_migration(client: TestClient, reset_in_memory_db):
    """
    Test that an active game started by an unauthenticated / guest user
    is seamlessly claimed when the user signs in and submits a guess.
    """
    # 1. Unauthenticated guest starts a game (defaults to dev-player-1 / guest)
    res_guest = client.post("/api/v1/games", json={"min_range": 1, "max_range": 100})
    assert res_guest.status_code == 201
    guest_game_id = res_guest.json()["game_id"]

    # 2. User signs in, receiving a new UID / Bearer token
    auth_headers = {"Authorization": "Bearer test-authenticated-user-456"}

    # 3. User submits a guess for the guest session ID - should NOT return 404
    res_guess = client.post(
        f"/api/v1/games/{guest_game_id}/guess",
        headers=auth_headers,
        json={"guess": 50},
    )
    assert res_guess.status_code == 200
    assert res_guess.json()["game_id"] == guest_game_id

    # 4. User's active game is now that game
    res_active = client.get("/api/v1/games/active", headers=auth_headers)
    assert res_active.status_code == 200
    assert res_active.json()["game_id"] == guest_game_id
