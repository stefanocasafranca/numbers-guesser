import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  photoURL?: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

export interface AuthContextType {
  user: (User | AppUser) | null;
  loading: boolean;
  token: string | null;
  isGuest: boolean;
  isDevMode: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

