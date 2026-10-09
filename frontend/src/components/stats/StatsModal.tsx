import React, { useState, useEffect, useCallback } from 'react';
import { api, type UserStatsResponse, type GameHistoryItem } from '../../services/api';
import { HistoryTable } from './HistoryTable';
import {
  X,
  Trophy,
  Zap,
  Flame,
  Target,
  BarChart2,
  RotateCcw,
} from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [historyGames, setHistoryGames] = useState<GameHistoryItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchStatsAndHistory = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.allSettled([
        api.getStats(),
        api.getHistory(targetPage, 8),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        // Fallback default stats
        setStats({
          total_games: 0,
          games_won: 0,
          best_score: null,
          current_streak: 0,
          avg_guesses: 0,
        });
      }

      if (historyRes.status === 'fulfilled') {
        setHistoryGames(historyRes.value.games || []);
        setTotal(historyRes.value.total || 0);
        setPage(historyRes.value.page || targetPage);
      } else {
        setHistoryGames([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      const timer = setTimeout(() => {
        if (!ignore) {
          fetchStatsAndHistory(1);
        }
      }, 0);
      return () => {
        ignore = true;
        clearTimeout(timer);
      };
    }
  }, [isOpen, fetchStatsAndHistory]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatsAndHistory(page);
  };

  if (!isOpen) return null;

  const winRate =
    stats && stats.total_games > 0
      ? Math.round((stats.games_won / stats.total_games) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-pop-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 z-10 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Player Statistics</h2>
              <p className="text-xs text-slate-400">Track your accuracy, streaks, and match history</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh stats"
            >
              <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto pt-6 space-y-6 flex-1 pr-1">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Win Rate */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Win Rate</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-2xl font-bold font-mono text-white">{winRate}%</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {stats?.games_won || 0} won of {stats?.total_games || 0}
                </p>
              </div>
            </div>

            {/* Best Score */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Best Score</span>
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {stats?.best_score !== null && stats?.best_score !== undefined
                    ? stats.best_score
                    : '—'}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">Fewest attempts</p>
              </div>
            </div>

            {/* Current Streak */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Streak</span>
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <span className="text-2xl font-bold font-mono text-indigo-400">
                  {stats?.current_streak || 0}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">Consecutive wins</p>
              </div>
            </div>

            {/* Avg Guesses */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Guesses</span>
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <span className="text-2xl font-bold font-mono text-cyan-400">
                  {stats?.avg_guesses || 0}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">Per victorious game</p>
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center justify-between">
              <span>Match History</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                {total} total games
              </span>
            </h3>
            <HistoryTable
              games={historyGames}
              loading={loading}
              page={page}
              total={total}
              limit={8}
              onPageChange={(newPage) => fetchStatsAndHistory(newPage)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
