"""Router for player statistics and performance metrics."""

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.schemas.game import AuthenticatedUser, UserStatsResponse
from app.services.firebase_service import BaseDatabaseService, get_database_service

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("", response_model=UserStatsResponse)
async def get_stats(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: BaseDatabaseService = Depends(get_database_service),
) -> UserStatsResponse:
    """Retrieve aggregate player stats (total games, wins, best score, streak, average)."""
    raw_stats = db.get_user_stats(current_user.uid) or {}

    total_games = int(raw_stats.get("totalGames", 0))
    games_won = int(raw_stats.get("gamesWon", 0))
    best_score = raw_stats.get("bestScore")
    if best_score is not None:
        best_score = int(best_score)
    current_streak = int(raw_stats.get("currentStreak", 0))
    avg_guesses = float(raw_stats.get("avgGuesses", 0.0))

    return UserStatsResponse(
        total_games=total_games,
        games_won=games_won,
        best_score=best_score,
        current_streak=current_streak,
        avg_guesses=avg_guesses,
    )
