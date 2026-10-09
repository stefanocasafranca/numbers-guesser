import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { GameBoard } from './components/game/GameBoard';
import { AuthModal } from './components/auth/AuthModal';
import { StatsModal } from './components/stats/StatsModal';
import {
  HelpCircle,
  Binary,
  ShieldCheck,
  Server,
  Cloud,
} from 'lucide-react';

const AppContent: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Game Center */}
        <div className="w-full relative z-10">
          <GameBoard onGameWon={() => {}} />
        </div>

        {/* How to Play / Info Section */}
        <div className="w-full max-w-2xl px-4 mt-4 mb-10 relative z-10">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              How It Works & Quick Tips
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/50">
                <span className="font-semibold text-slate-200 block mb-1">1. Binary Search</span>
                Pick the midpoint of the active range each turn to systematically eliminate 50% of the possibilities.
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/50">
                <span className="font-semibold text-slate-200 block mb-1">2. Hot/Cold Alerts</span>
                Watch the directional arrows to instantly know if you need to aim higher or lower.
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/50">
                <span className="font-semibold text-slate-200 block mb-1">3. Track Your Streak</span>
                Sign in with Google or Email to save your winning streak and climb the leaderboard!
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Binary className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400 font-medium">Numbers Guesser Cloud Edition</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-emerald-400" /> FastAPI
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Firebase Auth
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5 text-sky-400" /> Cloud Run & Hosting
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
