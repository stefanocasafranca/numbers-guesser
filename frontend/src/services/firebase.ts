import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDevAndEmulators123",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'guesser-82795'}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "guesser-82795",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'guesser-82795'}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "556583854957",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:556583854957:web:2b1603ce7dbb819375b064",
};


export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Optional Firebase Auth Emulator connection
const useEmulator =
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' ||
  Boolean(import.meta.env.VITE_AUTH_EMULATOR_URL);

// Detect whether dummy/placeholder credentials are in use
export const isMockFirebase =
  !useEmulator &&
  (!import.meta.env.VITE_FIREBASE_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY.includes('Example') ||
    import.meta.env.VITE_FIREBASE_API_KEY.includes('Dummy') ||
    import.meta.env.VITE_FIREBASE_API_KEY === 'AIzaSyExampleKey123456789' ||
    import.meta.env.VITE_DEV_MOCK_AUTH === 'true');

if (useEmulator && typeof window !== 'undefined') {
  const emulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
  try {
    const authInternal = auth as unknown as { emulatorConfig?: unknown };
    if (!authInternal.emulatorConfig) {
      connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
      console.info(`[Firebase] Connected to Auth Emulator at ${emulatorUrl}`);
    }
  } catch (error) {
    console.warn('[Firebase] Auth Emulator connection skipped or already initialized:', error);
  }
}

