"""Pydantic models for game requests, responses, history, and stats."""

from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator


GuessResult = Literal["HIGH", "LOW", "CORRECT"]
GameStatus = Literal["IN_PROGRESS", "WON", "FORFEIT"]


class StartGameRequest(BaseModel):
    """Payload to start a new game session."""

    min_range: int = Field(default=1, ge=1, description="Minimum possible number (inclusive)")
    max_range: int = Field(default=100, le=10000, description="Maximum possible number (inclusive)")

    @model_validator(mode="after")
    def validate_range(self) -> "StartGameRequest":
        if self.min_range >= self.max_range:
            raise ValueError("max_range must be strictly greater than min_range")
        return self


class StartGameResponse(BaseModel):
    """Response returned when a game session is created."""

    game_id: str
    min_range: int
    max_range: int
    status: GameStatus
    started_at: datetime


class GuessRequest(BaseModel):
    """Payload to submit a guess."""

    guess: int = Field(..., description="Player's guess")


class GuessItem(BaseModel):
    """An individual recorded guess."""

    guess: int
    result: GuessResult
    timestamp: datetime


class GuessResponse(BaseModel):
    """Feedback and state returned after a guess."""

    game_id: str
    guess: int
    result: GuessResult
    attempts: int
    is_game_over: bool
    past_guesses: List[GuessItem]
    target_number: Optional[int] = None
    message: str


class ActiveGameResponse(BaseModel):
    """Active game session representation."""

    game_id: str
    min_range: int
    max_range: int
    status: GameStatus
    attempts: int
    past_guesses: List[GuessItem]
    started_at: datetime


class GameHistoryItem(BaseModel):
    """Past game session summary."""

    game_id: str
    status: GameStatus
    min_range: int
    max_range: int
    attempts_count: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    target_number: Optional[int] = None


class GameHistoryResponse(BaseModel):
    """Paginated list of games."""

    games: List[GameHistoryItem]
    total: int
    page: int
    limit: int


class UserStatsResponse(BaseModel):
    """Aggregate player statistics."""

    total_games: int
    games_won: int
    best_score: Optional[int] = None
    current_streak: int
    avg_guesses: float


class AuthenticatedUser(BaseModel):
    """Verified user identity from auth token."""

    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None
