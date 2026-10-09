import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  api,
  type GuessItem,
  type GuessResult,
  type GameStatus,
  ApiError,
} from '../../services/api';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Trophy,
  Sliders,
  Send,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

interface GameBoardProps {
  onGameWon?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ onGameWon }) => {
  const { user, loading: authLoading } = useAuth();
  const [gameId, setGameId] = useState<string | null>(null);
  const [minRange, setMinRange] = useState<number>(1);
  const [maxRange, setMaxRange] = useState<number>(100);
  const [customMax, setCustomMax] = useState<number>(100);
  const [status, setStatus] = useState<GameStatus>('IN_PROGRESS');
  const [attempts, setAttempts] = useState<number>(0);
  const [pastGuesses, setPastGuesses] = useState<GuessItem[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    result: GuessResult | 'INVALID';
    message: string;
  } | null>(null);
  const [shake, setShake] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [offlineSecret, setOfflineSecret] = useState<number | null>(null);
  const [showRangeSettings, setShowRangeSettings] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger celebration confetti
  const fireVictoryConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#6366f1', '#a855f7', '#ec4899'],
    });
    fire(0.2, {
      spread: 60,
      colors: ['#10b981', '#3b82f6', '#f59e0b'],
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      colors: ['#eab308', '#ec4899', '#06b6d4'],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  // Start new game
  const startNewGame = async (rangeMax = customMax) => {
    setLoading(true);
    setFeedback(null);
    setCurrentGuess('');
    setTargetNumber(null);
    setStatus('IN_PROGRESS');
    setAttempts(0);
    setPastGuesses([]);

    try {
      const res = await api.startGame({ min_range: 1, max_range: rangeMax });
      setGameId(res.game_id);
      setMinRange(res.min_range);
      setMaxRange(res.max_range);
      setCustomMax(res.max_range);
      setOfflineSecret(null);
    } catch (err) {
      console.warn('[GameBoard] Backend unavailable for startGame, initiating offline game:', err);
      // Fallback offline game engine
      const randomTarget = Math.floor(Math.random() * rangeMax) + 1;
      setGameId(`offline-${Date.now()}`);
      setMinRange(1);
      setMaxRange(rangeMax);
      setOfflineSecret(randomTarget);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Check active game on mount and when auth state settles or changes
  useEffect(() => {
    let isMounted = true;
    if (authLoading) return;

    async function loadActiveGame() {
      try {
        const active = await api.getActiveGame();
        if (!isMounted) return;
        if (active && active.status === 'IN_PROGRESS') {
          setGameId(active.game_id);
          setMinRange(active.min_range);
          setMaxRange(active.max_range);
          setCustomMax(active.max_range);
          setStatus(active.status);
          setAttempts(active.attempts);
          setPastGuesses(active.past_guesses || []);
          if (active.past_guesses && active.past_guesses.length > 0) {
            const last = active.past_guesses[active.past_guesses.length - 1];
            setFeedback({
              result: last.result,
              message:
                last.result === 'HIGH'
                  ? 'Too high! Try a lower number.'
                  : last.result === 'LOW'
                  ? 'Too low! Try a higher number.'
                  : 'Correct guess!',
            });
          }
        } else {
          await startNewGame(100);
        }
      } catch (err) {
        console.warn('[GameBoard] Failed to fetch active game, creating new:', err);
        await startNewGame(100);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    loadActiveGame();
    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.uid]);

  // Calculate current narrowed search range
  const currentNarrowedRange = pastGuesses.reduce(
    (acc, g) => {
      if (g.result === 'LOW' && g.guess >= acc.min) {
        return { ...acc, min: g.guess + 1 };
      }
      if (g.result === 'HIGH' && g.guess <= acc.max) {
        return { ...acc, max: g.guess - 1 };
      }
      return acc;
    },
    { min: minRange, max: maxRange }
  );

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || status === 'WON') return;

    const num = parseInt(currentGuess.trim(), 10);
    if (isNaN(num)) {
      setFeedback({ result: 'INVALID', message: 'Please enter a valid number.' });
      triggerShake();
      return;
    }

    if (num < minRange || num > maxRange) {
      setFeedback({
        result: 'INVALID',
        message: `Number must be between ${minRange} and ${maxRange}.`,
      });
      triggerShake();
      return;
    }

    setLoading(true);

    // If running in offline fallback mode
    if (offlineSecret !== null || (gameId && gameId.startsWith('offline-'))) {
      const secret = offlineSecret ?? 50;
      let resType: GuessResult = 'CORRECT';
      let msg = 'Congratulations! You guessed the number!';

      if (num > secret) {
        resType = 'HIGH';
        msg = 'Too high! Try a lower number.';
      } else if (num < secret) {
        resType = 'LOW';
        msg = 'Too low! Try a higher number.';
      }

      const newGuess: GuessItem = {
        guess: num,
        result: resType,
        timestamp: new Date().toISOString(),
      };
      const updatedGuesses = [...pastGuesses, newGuess];
      setPastGuesses(updatedGuesses);
      setAttempts(updatedGuesses.length);
      setFeedback({ result: resType, message: msg });
      setCurrentGuess('');

      if (resType === 'CORRECT') {
        setStatus('WON');
        setTargetNumber(secret);
        fireVictoryConfetti();
        if (onGameWon) onGameWon();
      } else {
        triggerShake();
      }
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Call backend API
    try {
      if (!gameId) throw new Error('No active game');
      const response = await api.submitGuess(gameId, num);

      setPastGuesses(response.past_guesses);
      setAttempts(response.attempts);
      setFeedback({
        result: response.result,
        message: response.message,
      });
      setCurrentGuess('');

      if (response.is_game_over || response.result === 'CORRECT') {
        setStatus('WON');
        if (response.target_number !== undefined) {
          setTargetNumber(response.target_number);
        }
        fireVictoryConfetti();
        if (onGameWon) onGameWon();
      } else {
        triggerShake();
      }
    } catch (err: unknown) {
      let msg = 'Failed to submit guess.';
      if (err instanceof ApiError) {
        msg = err.detail;
        if (err.status === 404) {
          console.warn('[GameBoard] Game session not found on server. Starting fresh session.');
          setFeedback({
            result: 'INVALID',
            message: 'Game session expired or not found. Starting a fresh game...',
          });
          triggerShake();
          setTimeout(() => {
            startNewGame(customMax);
          }, 800);
          return;
        }
      }
      setFeedback({ result: 'INVALID', message: msg });
      triggerShake();
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (initialLoading) {
    return (
      <div className="w-full max-w-xl mx-auto py-24 text-center">
        <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Preparing game board...</p>
      </div>
    );
  }

  const isWon = status === 'WON';

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Hero Game Card */}
      <div
        className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${
          isWon
            ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/50 shadow-2xl shadow-emerald-500/10'
            : 'bg-slate-900/90 border-slate-800 shadow-2xl shadow-indigo-950/40'
        } ${shake ? 'animate-wiggle' : ''}`}
      >
        {/* Glow ambient background lights */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
        {isWon && (
          <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
        )}

        <div className="p-6 sm:p-10 relative z-10">
          {/* Top Bar: Range Badge & Attempts Counter */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Range:
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                {minRange} – {maxRange}
              </span>
              <button
                type="button"
                onClick={() => setShowRangeSettings(!showRangeSettings)}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition"
                title="Change difficulty / max range"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attempts:
              </span>
              <div className="px-3 py-1 rounded-full bg-slate-800 text-white font-mono font-bold text-xs border border-slate-700">
                {attempts}
              </div>
            </div>
          </div>

          {/* Range Settings Dropdown / Drawer */}
          {showRangeSettings && (
            <div className="mb-8 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 animate-pop-in">
              <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Select Difficulty Range:
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1000].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setCustomMax(r);
                      setShowRangeSettings(false);
                      startNewGame(r);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      maxRange === r
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    1 – {r} {r === 100 ? '(Classic)' : r === 500 ? '(Medium)' : '(Hard)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Centerpiece Hero */}
          <div className="text-center my-4">
            {isWon ? (
              <div className="space-y-4 animate-pop-in">
                <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/20">
                  <Trophy className="w-12 h-12" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Victory!
                </h2>
                <p className="text-slate-300 text-sm max-w-sm mx-auto">
                  You discovered the secret number{' '}
                  <span className="font-mono font-black text-emerald-400 text-lg">
                    {targetNumber ?? currentGuess}
                  </span>{' '}
                  in{' '}
                  <span className="font-bold text-white">
                    {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
                  </span>
                  !
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => startNewGame(maxRange)}
                    type="button"
                    className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase font-bold tracking-widest text-indigo-400 mb-2">
                  Find The Secret Number
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Between {minRange} and {maxRange}
                </h1>

                {/* Narrowed hint indicator */}
                {pastGuesses.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2 font-mono">
                    Suggested target range:{' '}
                    <span className="text-slate-200 font-bold">
                      [{currentNarrowedRange.min} – {currentNarrowedRange.max}]
                    </span>
                  </p>
                )}

                {/* Number Input Form */}
                <form onSubmit={handleGuessSubmit} className="mt-8 max-w-sm mx-auto">
                  <div className="relative flex items-center">
                    <input
                      ref={inputRef}
                      type="number"
                      min={minRange}
                      max={maxRange}
                      placeholder="?"
                      value={currentGuess}
                      onChange={(e) => setCurrentGuess(e.target.value)}
                      disabled={loading}
                      className="w-full text-center py-4 text-3xl sm:text-4xl font-mono font-bold rounded-2xl bg-slate-950 border-2 border-slate-700/80 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={loading || !currentGuess.trim()}
                      className="absolute right-2.5 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white shadow-md transition active:scale-95"
                      title="Submit Guess"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Feedback Animation Pill */}
          {feedback && !isWon && (
            <div className="mt-6 flex justify-center animate-pop-in">
              <div
                className={`inline-flex items-center space-x-2.5 px-5 py-2.5 rounded-full text-sm font-semibold border shadow-lg ${
                  feedback.result === 'HIGH'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-rose-950/20'
                    : feedback.result === 'LOW'
                    ? 'bg-sky-500/15 border-sky-500/30 text-sky-300 shadow-sky-950/20'
                    : feedback.result === 'CORRECT'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-emerald-950/20'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-amber-950/20'
                }`}
              >
                {feedback.result === 'HIGH' && (
                  <ArrowDown className="w-4 h-4 text-rose-400 animate-bounce" />
                )}
                {feedback.result === 'LOW' && (
                  <ArrowUp className="w-4 h-4 text-sky-400 animate-bounce" />
                )}
                {feedback.result === 'CORRECT' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {feedback.result === 'INVALID' && (
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                )}
                <span>{feedback.message}</span>
              </div>
            </div>
          )}

          {/* Past Guess Pills / Attempt History */}
          {pastGuesses.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-3">
                <span>Recent Guesses ({pastGuesses.length})</span>
                <span className="text-slate-500">Order: Oldest → Newest</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {pastGuesses.map((item, index) => {
                  const isHigh = item.result === 'HIGH';
                  const isCorrect = item.result === 'CORRECT';
                  return (
                    <div
                      key={index}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border ${
                        isCorrect
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : isHigh
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                          : 'bg-sky-500/10 border-sky-500/25 text-sky-300'
                      }`}
                    >
                      <span className="text-slate-400 font-sans text-[10px]">#{index + 1}</span>
                      <span className="font-bold">{item.guess}</span>
                      {isCorrect ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : isHigh ? (
                        <ArrowDown className="w-3 h-3 text-rose-400 shrink-0" />
                      ) : (
                        <ArrowUp className="w-3 h-3 text-sky-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions on Card */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => startNewGame(maxRange)}
            className="flex items-center space-x-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Game</span>
          </button>

          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            High / Low Hot-Cold Guidance
          </span>
        </div>
      </div>
    </div>
  );
};
