"""Router for game creation, guess submission, active game retrieval, and history."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.schemas.game import (
    ActiveGameResponse,
    AuthenticatedUser,
    GameHistoryItem,
    GameHistoryResponse,
    GuessItem,
    GuessRequest,
    GuessResponse,
    StartGameRequest,
    StartGameResponse,
)
from app.services.firebase_service import BaseDatabaseService, get_database_service
from app.services.game_engine import (
    calculate_updated_stats,
    evaluate_guess,
    generate_secret_number,
)

router = APIRouter(prefix="/api/v1/games", tags=["games"])


@router.post("", response_model=StartGameResponse, status_code=status.HTTP_201_CREATED)
async def start_game(
    request: Optional[StartGameRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: BaseDatabaseService = Depends(get_database_service),
) -> StartGameResponse:
    """
    Start a new game session. If an existing game is still IN_PROGRESS,
    it is automatically marked as FORFEIT to maintain a single active session.
    """
    req = request or StartGameRequest()
    now = datetime.now(timezone.utc)

    # 1. Ensure user record exists
    db.get_or_create_user(
        uid=current_user.uid,
        email=current_user.email,
        display_name=current_user.display_name,
    )

    # 2. Forfeit any currently active game
    active_game = db.get_active_game(current_user.uid)
    if active_game:
        db.update_game(
            current_user.uid,
            active_game["gameId"],
            {"status": "FORFEIT", "completedAt": now},
        )
        # Update stats to record forfeit as a lost game
        stats = db.get_user_stats(current_user.uid)
        updated_stats = calculate_updated_stats(stats, is_win=False, attempts=active_game.get("attemptsCount", 0))
        db.update_user_stats(current_user.uid, updated_stats)

    # 3. Create new game
    game_id = uuid.uuid4().hex
    secret_number = generate_secret_number(req.min_range, req.max_range)

    game_data = {
        "gameId": game_id,
        "targetNumber": secret_number,
        "minRange": req.min_range,
        "maxRange": req.max_range,
        "status": "IN_PROGRESS",
        "attemptsCount": 0,
        "startedAt": now,
        "completedAt": None,
        "guesses": [],
    }

    db.create_game(current_user.uid, game_data)

    return StartGameResponse(
        game_id=game_id,
        min_range=req.min_range,
        max_range=req.max_range,
        status="IN_PROGRESS",
        started_at=now,
    )


@router.post("/{game_id}/guess", response_model=GuessResponse)
async def submit_guess(
    game_id: str,
    guess_req: GuessRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: BaseDatabaseService = Depends(get_database_service),
) -> GuessResponse:
    """
    Submit a guess for an active game session.
    Returns HIGH, LOW, or CORRECT feedback, updates attempt count, and records history.
    """
    game = db.get_game(current_user.uid, game_id)
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game session with ID '{game_id}' not found.",
        )

    if game.get("status") != "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Game is already completed with status '{game.get('status')}'.",
        )

    min_range = game.get("minRange", 1)
    max_range = game.get("maxRange", 100)
    guess = guess_req.guess

    if guess < min_range or guess > max_range:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guess must be between {min_range} and {max_range}.",
        )

    target_number = game["targetNumber"]
    result, message = evaluate_guess(guess, target_number)
    now = datetime.now(timezone.utc)

    guesses = list(game.get("guesses", []))
    new_guess_item = {
        "guess": guess,
        "result": result,
        "timestamp": now,
    }
    guesses.append(new_guess_item)
    attempts_count = len(guesses)

    is_win = (result == "CORRECT")
    updates = {
        "guesses": guesses,
        "attemptsCount": attempts_count,
    }

    if is_win:
        updates["status"] = "WON"
        updates["completedAt"] = now

        # Update stats
        stats = db.get_user_stats(current_user.uid)
        updated_stats = calculate_updated_stats(stats, is_win=True, attempts=attempts_count)
        db.update_user_stats(current_user.uid, updated_stats)

    db.update_game(current_user.uid, game_id, updates)

    # Format past guesses for response
    past_guesses_models = [
        GuessItem(
            guess=g["guess"],
            result=g["result"],
            timestamp=g["timestamp"],
        )
        for g in guesses
    ]

    return GuessResponse(
        game_id=game_id,
        guess=guess,
        result=result,
        attempts=attempts_count,
        is_game_over=is_win,
        past_guesses=past_guesses_models,
        target_number=target_number if is_win else None,
        message=message,
    )


@router.get("/active", response_model=Optional[ActiveGameResponse])
async def get_active_game(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: BaseDatabaseService = Depends(get_database_service),
) -> Optional[ActiveGameResponse]:
    """Retrieve the currently active game session for the player if one exists."""
    game = db.get_active_game(current_user.uid)
    if not game:
        return None

    past_guesses = [
        GuessItem(
            guess=g["guess"],
            result=g["result"],
            timestamp=g["timestamp"],
        )
        for g in game.get("guesses", [])
    ]

    return ActiveGameResponse(
        game_id=game["gameId"],
        min_range=game.get("minRange", 1),
        max_range=game.get("maxRange", 100),
        status=game["status"],
        attempts=game.get("attemptsCount", len(past_guesses)),
        past_guesses=past_guesses,
        started_at=game["startedAt"],
    )


@router.get("/history", response_model=GameHistoryResponse)
async def get_game_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=50, description="Items per page"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: BaseDatabaseService = Depends(get_database_service),
) -> GameHistoryResponse:
    """Retrieve paginated game history for the current player."""
    games_data, total = db.list_games_history(current_user.uid, page=page, limit=limit)

    items = []
    for g in games_data:
        is_completed = g.get("status") != "IN_PROGRESS"
        items.append(
            GameHistoryItem(
                game_id=g["gameId"],
                status=g["status"],
                min_range=g.get("minRange", 1),
                max_range=g.get("maxRange", 100),
                attempts_count=g.get("attemptsCount", len(g.get("guesses", []))),
                started_at=g["startedAt"],
                completed_at=g.get("completedAt"),
                # Only reveal target number if game has concluded
                target_number=g.get("targetNumber") if is_completed else None,
            )
        )

    return GameHistoryResponse(
        games=items,
        total=total,
        page=page,
        limit=limit,
    )
