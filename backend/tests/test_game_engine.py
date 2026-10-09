"""Unit tests for the game engine and scoring logic."""

import pytest
from app.services.game_engine import (
    calculate_updated_stats,
    evaluate_guess,
    generate_secret_number,
)


def test_generate_secret_number_bounds():
    """Verify generated secret numbers fall within expected boundaries."""
    for _ in range(100):
        val = generate_secret_number(1, 100)
        assert 1 <= val <= 100

    for _ in range(50):
        val = generate_secret_number(40, 45)
        assert 40 <= val <= 45


def test_evaluate_guess_outcomes():
    """Verify correct classification of HIGH, LOW, and CORRECT guesses."""
    target = 50

    # Guess higher than target
    res_high, msg_high = evaluate_guess(75, target)
    assert res_high == "HIGH"
    assert "Too high" in msg_high

    # Guess lower than target
    res_low, msg_low = evaluate_guess(25, target)
    assert res_low == "LOW"
    assert "Too low" in msg_low

    # Exact guess
    res_correct, msg_correct = evaluate_guess(50, target)
    assert res_correct == "CORRECT"
    assert "Congratulations" in msg_correct


def test_calculate_updated_stats_first_win():
    """Verify stats initialization after the first win."""
    stats = calculate_updated_stats(None, is_win=True, attempts=5)
    assert stats["totalGames"] == 1
    assert stats["gamesWon"] == 1
    assert stats["bestScore"] == 5
    assert stats["currentStreak"] == 1
    assert stats["avgGuesses"] == 5.0


def test_calculate_updated_stats_consecutive_wins_and_streak():
    """Verify streak increments and best score updates when smaller."""
    initial_stats = {
        "totalGames": 1,
        "gamesWon": 1,
        "bestScore": 6,
        "currentStreak": 1,
        "totalGuessesWon": 6,
        "avgGuesses": 6.0,
    }

    # Second win with better score (3 attempts)
    new_stats = calculate_updated_stats(initial_stats, is_win=True, attempts=3)
    assert new_stats["totalGames"] == 2
    assert new_stats["gamesWon"] == 2
    assert new_stats["bestScore"] == 3
    assert new_stats["currentStreak"] == 2
    assert new_stats["totalGuessesWon"] == 9
    assert new_stats["avgGuesses"] == 4.5  # (6 + 3) / 2


def test_calculate_updated_stats_loss_or_forfeit():
    """Verify forfeit/loss increments totalGames and resets streak."""
    stats_with_streak = {
        "totalGames": 3,
        "gamesWon": 3,
        "bestScore": 4,
        "currentStreak": 3,
        "totalGuessesWon": 15,
        "avgGuesses": 5.0,
    }

    lost_stats = calculate_updated_stats(stats_with_streak, is_win=False, attempts=2)
    assert lost_stats["totalGames"] == 4
    assert lost_stats["gamesWon"] == 3
    assert lost_stats["bestScore"] == 4
    assert lost_stats["currentStreak"] == 0
    assert lost_stats["avgGuesses"] == 5.0
