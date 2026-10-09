import { auth } from './firebase';

export type GuessResult = 'HIGH' | 'LOW' | 'CORRECT';
export type GameStatus = 'IN_PROGRESS' | 'WON' | 'FORFEIT';

export interface StartGameRequest {
  min_range?: number;
  max_range?: number;
}

export interface StartGameResponse {
  game_id: string;
  min_range: number;
  max_range: number;
  status: GameStatus;
  started_at: string;
}

export interface GuessRequest {
  guess: number;
}

export interface GuessItem {
  guess: number;
  result: GuessResult;
  timestamp: string;
}

export interface GuessResponse {
  game_id: string;
  guess: number;
  result: GuessResult;
  attempts: number;
  is_game_over: boolean;
  past_guesses: GuessItem[];
  target_number?: number | null;
  message: string;
}

export interface ActiveGameResponse {
  game_id: string;
  min_range: number;
  max_range: number;
  status: GameStatus;
  attempts: number;
  past_guesses: GuessItem[];
  started_at: string;
}

export interface GameHistoryItem {
  game_id: string;
  status: GameStatus;
  min_range: number;
  max_range: number;
  attempts_count: number;
  started_at: string;
  completed_at?: string | null;
  target_number?: number | null;
}

export interface GameHistoryResponse {
  games: GameHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface UserStatsResponse {
  total_games: number;
  games_won: number;
  best_score: number | null;
  current_streak: number;
  avg_guesses: number;
}

// Base URL resolution: use explicit VITE_API_URL or relative path for proxy/hosting rewrites
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API error with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // Attach Firebase ID token if user is signed in
  let tokenAttached = false;
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        tokenAttached = true;
      }
    }
  } catch (err) {
    console.warn('[API] Could not retrieve Firebase ID token:', err);
  }

  // Fallback to dev/mock token from localStorage
  if (!tokenAttached && !headers.has('Authorization')) {
    const devToken = localStorage.getItem('ng_dev_token');
    if (devToken) {
      headers.set('Authorization', `Bearer ${devToken}`);
      tokenAttached = true;
    }
  }

  // Fallback for anonymous dev sessions if no Bearer token
  const devUserId = localStorage.getItem('ng_dev_user_id') || 'guest_user';
  headers.set('X-Dev-User-ID', devUserId);


  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      // Body is not JSON
    }
    throw new ApiError(response.status, errorDetail);
  }

  // Return null on 204 No Content
  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json();
}

export const api = {
  // Games
  startGame: async (params?: StartGameRequest): Promise<StartGameResponse> => {
    return request<StartGameResponse>('/api/v1/games', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  },

  submitGuess: async (gameId: string, guess: number): Promise<GuessResponse> => {
    return request<GuessResponse>(`/api/v1/games/${gameId}/guess`, {
      method: 'POST',
      body: JSON.stringify({ guess }),
    });
  },

  getActiveGame: async (): Promise<ActiveGameResponse | null> => {
    try {
      return await request<ActiveGameResponse | null>('/api/v1/games/active');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  getHistory: async (page = 1, limit = 10): Promise<GameHistoryResponse> => {
    return request<GameHistoryResponse>(`/api/v1/games/history?page=${page}&limit=${limit}`);
  },

  // Stats
  getStats: async (): Promise<UserStatsResponse> => {
    return request<UserStatsResponse>('/api/v1/stats');
  },
};
