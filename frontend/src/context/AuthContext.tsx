import React, { useEffect, useState, type ReactNode } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isMockFirebase } from '../services/firebase';
import { AuthContext, type AppUser } from './authContextDef';

const DEV_SESSION_KEY = 'ng_dev_auth_session';

function createMockUser(params: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  photoURL?: string | null;
  token?: string;
}): AppUser {
  const token = params.token || `dev-token-${params.uid}`;
  return {
    uid: params.uid,
    email: params.email ?? null,
    displayName: params.displayName ?? null,
    isAnonymous: Boolean(params.isAnonymous),
    photoURL: params.photoURL ?? null,
    getIdToken: async () => token,
  };
}

function saveDevSession(user: AppUser, tokenStr?: string) {
  const token = tokenStr || `dev-token-${user.uid}`;
  const data = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    isAnonymous: user.isAnonymous,
    photoURL: user.photoURL,
    token: token,
  };
  localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(data));
  localStorage.setItem('ng_dev_token', token);
  localStorage.setItem('ng_dev_user_id', user.uid);
}

function loadDevSession(): { user: AppUser; token: string } | null {
  try {
    const raw = localStorage.getItem(DEV_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.uid) return null;
    const token = data.token || `dev-token-${data.uid}`;
    return {
      user: {
        uid: data.uid,
        displayName: data.displayName || null,
        email: data.email || null,
        isAnonymous: Boolean(data.isAnonymous),
        photoURL: data.photoURL || null,
        getIdToken: async () => token,
      },
      token: token,
    };
  } catch {
    return null;
  }
}

function clearDevSession() {
  localStorage.removeItem(DEV_SESSION_KEY);
  localStorage.removeItem('ng_dev_token');
  localStorage.removeItem('ng_dev_user_id');
}

function isNetworkError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const code = (err as { code?: string }).code;
    const msg = (err as { message?: string }).message || '';
    if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
      return true;
    }
  }
  return false;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User | AppUser) | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDevMode, setIsDevMode] = useState<boolean>(isMockFirebase);

  // Keep ID token updated whenever user state changes
  useEffect(() => {
    // 1. Check for stored dev session if in mock mode
    if (isMockFirebase) {
      const saved = loadDevSession();
      if (saved) {
        setUser(saved.user);
        setToken(saved.token);
      }
      setLoading(false);
      return;
    }

    // 2. Real Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
        } catch (err) {
          console.error('[AuthContext] Failed to retrieve ID token:', err);
          setToken(null);
        }
      } else {
        const saved = loadDevSession();
        if (saved) {
          setUser(saved.user);
          setToken(saved.token);
        } else {
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (token) return token;
    if (user) {
      try {
        const refreshed = await user.getIdToken(forceRefresh);
        setToken(refreshed);
        return refreshed;
      } catch (err) {
        console.error('[AuthContext] Error getting refreshed token:', err);
        return null;
      }
    }
    return null;
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (isMockFirebase || isDevMode) {
      const sanitizedId = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const mockUser = createMockUser({
        uid: `dev_${sanitizedId}`,
        displayName: email.split('@')[0],
        email: email,
        isAnonymous: false,
        token: `dev-token-${sanitizedId}`,
      });
      saveDevSession(mockUser);
      setUser(mockUser);
      setToken(`dev-token-${sanitizedId}`);
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        console.warn('[AuthContext] Network request failed. Falling back to local offline dev session.');
        setIsDevMode(true);
        const sanitizedId = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const mockUser = createMockUser({
          uid: `dev_${sanitizedId}`,
          displayName: email.split('@')[0],
          email: email,
          isAnonymous: false,
          token: `dev-token-${sanitizedId}`,
        });
        saveDevSession(mockUser);
        setUser(mockUser);
        setToken(`dev-token-${sanitizedId}`);
        return;
      }
      throw err;
    }
  };

  const signupWithEmail = async (email: string, password: string, displayName?: string) => {
    if (isMockFirebase || isDevMode) {
      const sanitizedId = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const mockUser = createMockUser({
        uid: `dev_${sanitizedId}`,
        displayName: displayName || email.split('@')[0],
        email: email,
        isAnonymous: false,
        token: `dev-token-${sanitizedId}`,
      });
      saveDevSession(mockUser);
      setUser(mockUser);
      setToken(`dev-token-${sanitizedId}`);
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        console.warn('[AuthContext] Network request failed. Falling back to local offline dev session.');
        setIsDevMode(true);
        const sanitizedId = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const mockUser = createMockUser({
          uid: `dev_${sanitizedId}`,
          displayName: displayName || email.split('@')[0],
          email: email,
          isAnonymous: false,
          token: `dev-token-${sanitizedId}`,
        });
        saveDevSession(mockUser);
        setUser(mockUser);
        setToken(`dev-token-${sanitizedId}`);
        return;
      }
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    if (isMockFirebase || isDevMode) {
      const mockUser = createMockUser({
        uid: 'dev_google_player',
        displayName: 'Google Dev Player',
        email: 'dev.player@gmail.com',
        isAnonymous: false,
        photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GooglePlayer',
        token: 'dev-token-google-player',
      });
      saveDevSession(mockUser);
      setUser(mockUser);
      setToken('dev-token-google-player');
      return;
    }

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        console.warn('[AuthContext] Network request failed. Falling back to simulated Google sign-in.');
        setIsDevMode(true);
        const mockUser = createMockUser({
          uid: 'dev_google_player',
          displayName: 'Google Dev Player',
          email: 'dev.player@gmail.com',
          isAnonymous: false,
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GooglePlayer',
          token: 'dev-token-google-player',
        });
        saveDevSession(mockUser);
        setUser(mockUser);
        setToken('dev-token-google-player');
        return;
      }
      throw err;
    }
  };

  const loginAsGuest = async () => {
    if (isMockFirebase || isDevMode) {
      const guestId = `guest_${Math.random().toString(36).substring(2, 8)}`;
      const mockUser = createMockUser({
        uid: guestId,
        displayName: 'Guest Player',
        email: null,
        isAnonymous: true,
        token: `dev-guest-${guestId}`,
      });
      saveDevSession(mockUser);
      setUser(mockUser);
      setToken(`dev-guest-${guestId}`);
      return;
    }

    try {
      const credential = await signInAnonymously(auth);
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        console.warn('[AuthContext] Network request failed. Falling back to local offline guest mode.');
        setIsDevMode(true);
        const guestId = `guest_${Math.random().toString(36).substring(2, 8)}`;
        const mockUser = createMockUser({
          uid: guestId,
          displayName: 'Guest Player',
          email: null,
          isAnonymous: true,
          token: `dev-guest-${guestId}`,
        });
        saveDevSession(mockUser);
        setUser(mockUser);
        setToken(`dev-guest-${guestId}`);
        return;
      }
      throw err;
    }
  };

  const logout = async () => {
    clearDevSession();
    try {
      await signOut(auth);
    } catch {
      // Swallowed in offline or mock mode
    }
    setUser(null);
    setToken(null);
  };

  const isGuest = Boolean(user && user.isAnonymous);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        isGuest,
        isDevMode,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginAsGuest,
        logout,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

