"""Core game engine for number generation, guess evaluation, and scoring."""

import random
from typing import Dict, Any, Optional, Tuple
from app.schemas.game import GuessResult


def generate_secret_number(min_range: int = 1, max_range: int = 100) -> int:
    """Generate a random secret number between min_range and max_range inclusive."""
    return random.randint(min_range, max_range)


def evaluate_guess(guess: int, target: int) -> Tuple[GuessResult, str]:
    """
    Compare guess with target number and return result and descriptive message.
    """
    if guess > target:
        return "HIGH", "Too high! Try a lower number."
    elif guess < target:
        return "LOW", "Too low! Try a higher number."
    else:
        return "CORRECT", "Congratulations! You guessed the number!"


def calculate_updated_stats(
    current_stats: Optional[Dict[str, Any]],
    is_win: bool,
    attempts: int,
) -> Dict[str, Any]:
    """
    Update player stats given the outcome of a completed game.
    """
    stats = current_stats.copy() if current_stats else {}

    total_games = int(stats.get("totalGames", 0)) + 1
    games_won = int(stats.get("gamesWon", 0))
    current_streak = int(stats.get("currentStreak", 0))
    best_score = stats.get("bestScore")
    total_guesses_won = int(stats.get("totalGuessesWon", 0))

    if is_win:
        games_won += 1
        current_streak += 1
        total_guesses_won += attempts
        if best_score is None:
            best_score = attempts
        else:
            best_score = min(int(best_score), attempts)
    else:
        current_streak = 0

    avg_guesses = round(total_guesses_won / games_won, 2) if games_won > 0 else 0.0

    return {
        "totalGames": total_games,
        "gamesWon": games_won,
        "bestScore": best_score,
        "currentStreak": current_streak,
        "totalGuessesWon": total_guesses_won,
        "avgGuesses": avg_guesses,
    }
