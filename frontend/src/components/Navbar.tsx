import React from 'react';
import { useAuth } from '../context/useAuth';
import { BarChart3, LogIn, LogOut, User as UserIcon, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenStats: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onOpenStats }) => {
  const { user, isGuest, logout } = useAuth();

  const getDisplayName = () => {
    if (!user) return '';
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split('@')[0];
    if (isGuest) return 'Guest Player';
    return 'Player';
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <span className="font-mono text-xl font-black bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                #?
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-white font-sans">
                Numbers Guesser
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3 h-3" /> Live
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Guess the secret number</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Stats Button */}
          <button
            onClick={onOpenStats}
            type="button"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/60 transition-all duration-150 hover:border-slate-600 active:scale-95 shadow-sm"
            title="View your statistics and past games"
          >
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Stats & History</span>
          </button>

          {/* User profile / Auth buttons */}
          {user ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={getDisplayName()}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 leading-none">
                    {getDisplayName()}
                  </span>
                  {isGuest && (
                    <span className="text-[10px] text-amber-400/90 font-mono leading-none mt-0.5">
                      Guest Mode
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={logout}
                type="button"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              type="button"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition-all duration-150 hover:shadow-indigo-600/40 active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
