import React from 'react';
import type { GameHistoryItem } from '../../services/api';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface HistoryTableProps {
  games: GameHistoryItem[];
  loading: boolean;
  page: number;
  total: number;
  limit: number;
  onPageChange: (newPage: number) => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  games,
  loading,
  page,
  total,
  limit,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs">Loading game records...</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="py-10 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/80">
        <p className="text-sm font-medium text-slate-300">No match records found</p>
        <p className="text-xs text-slate-500 mt-1">Play your first game to start tracking results!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-3.5">Outcome</th>
              <th className="py-3 px-3.5">Target</th>
              <th className="py-3 px-3.5">Attempts</th>
              <th className="py-3 px-3.5">Range</th>
              <th className="py-3 px-3.5 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {games.map((g) => {
              const isWon = g.status === 'WON';
              const isInProgress = g.status === 'IN_PROGRESS';

              return (
                <tr key={g.game_id} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-3.5 font-sans">
                    {isWon ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Won
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <XCircle className="w-3 h-3" /> Forfeit
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3.5 font-bold text-slate-200">
                    {g.target_number !== null && g.target_number !== undefined
                      ? g.target_number
                      : '—'}
                  </td>
                  <td className="py-3 px-3.5 text-slate-300">{g.attempts_count}</td>
                  <td className="py-3 px-3.5 text-slate-400">
                    {g.min_range} – {g.max_range}
                  </td>
                  <td className="py-3 px-3.5 text-right font-sans text-slate-400">
                    {formatDate(g.completed_at || g.started_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Page {page} of {totalPages} ({total} games)
          </span>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
