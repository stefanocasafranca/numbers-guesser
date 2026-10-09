"""Firebase and Firestore connection management with zero-config in-memory fallback."""

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.auth.exceptions import DefaultCredentialsError

from app.config import get_settings

logger = logging.getLogger("numbers_guesser.firebase")
settings = get_settings()


class BaseDatabaseService:
    """Abstract interface for database operations."""

    def get_or_create_user(
        self, uid: str, email: Optional[str] = None, display_name: Optional[str] = None
    ) -> Dict[str, Any]:
        raise NotImplementedError

    def get_user_stats(self, uid: str) -> Dict[str, Any]:
        raise NotImplementedError

    def update_user_stats(self, uid: str, stats: Dict[str, Any]) -> None:
        raise NotImplementedError

    def create_game(self, uid: str, game_data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def get_game(self, uid: str, game_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def get_active_game(self, uid: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def update_game(self, uid: str, game_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_games_history(
        self, uid: str, page: int = 1, limit: int = 10
    ) -> Tuple[List[Dict[str, Any]], int]:
        raise NotImplementedError


class InMemoryDatabaseService(BaseDatabaseService):
    """Thread-safe in-memory store for instant zero-config testing and local dev."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._users: Dict[str, Dict[str, Any]] = {}
        self._games: Dict[str, Dict[str, Dict[str, Any]]] = {}  # uid -> game_id -> game_dict
        logger.info("[FirebaseService] Initialized In-Memory Database store.")

    def get_or_create_user(
        self, uid: str, email: Optional[str] = None, display_name: Optional[str] = None
    ) -> Dict[str, Any]:
        with self._lock:
            if uid not in self._users:
                self._users[uid] = {
                    "uid": uid,
                    "email": email or "",
                    "displayName": display_name or "",
                    "createdAt": datetime.now(timezone.utc),
                    "stats": {
                        "totalGames": 0,
                        "gamesWon": 0,
                        "bestScore": None,
                        "currentStreak": 0,
                        "totalGuessesWon": 0,
                        "avgGuesses": 0.0,
                    },
                }
            return self._users[uid]

    def get_user_stats(self, uid: str) -> Dict[str, Any]:
        user = self.get_or_create_user(uid)
        return user.get("stats", {})

    def update_user_stats(self, uid: str, stats: Dict[str, Any]) -> None:
        with self._lock:
            if uid not in self._users:
                self.get_or_create_user(uid)
            self._users[uid]["stats"] = stats

    def create_game(self, uid: str, game_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            if uid not in self._games:
                self._games[uid] = {}
            game_id = game_data["gameId"]
            self._games[uid][game_id] = game_data.copy()
            return self._games[uid][game_id]

    def get_game(self, uid: str, game_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            game = self._games.get(uid, {}).get(game_id)
            if game is not None:
                return game

            # If not found directly under uid, search other sessions (e.g. guest or dev session
            # created before the player logged in) and transfer ownership to this user.
            for owner_uid, user_games in list(self._games.items()):
                if owner_uid != uid and game_id in user_games:
                    if uid not in self._games:
                        self._games[uid] = {}
                    self._games[uid][game_id] = user_games.pop(game_id)
                    logger.info(
                        f"[FirebaseService] Migrated game {game_id} ownership from {owner_uid} to {uid}"
                    )
                    return self._games[uid][game_id]
            return None

    def get_active_game(self, uid: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            user_games = self._games.get(uid, {})
            # Find the most recently started IN_PROGRESS game
            active_games = [
                g for g in user_games.values() if g.get("status") == "IN_PROGRESS"
            ]
            if active_games:
                active_games.sort(key=lambda x: x.get("startedAt") or datetime.min, reverse=True)
                return active_games[0]

            # If the user has no active game, check if there is an in-progress game from a guest
            # or dev session and claim ownership.
            for guest_uid in ["guest_user", "dev-player-1"]:
                if guest_uid != uid and guest_uid in self._games:
                    guest_active = [
                        g for g in self._games[guest_uid].values()
                        if g.get("status") == "IN_PROGRESS"
                    ]
                    if guest_active:
                        guest_active.sort(key=lambda x: x.get("startedAt") or datetime.min, reverse=True)
                        claimed = guest_active[0]
                        gid = claimed["gameId"]
                        if uid not in self._games:
                            self._games[uid] = {}
                        self._games[uid][gid] = self._games[guest_uid].pop(gid)
                        logger.info(
                            f"[FirebaseService] Claimed guest active game {gid} for user {uid}"
                        )
                        return self._games[uid][gid]
            return None

    def update_game(self, uid: str, game_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            if uid not in self._games or game_id not in self._games[uid]:
                # Try finding across other sessions to transfer
                for owner_uid, user_games in list(self._games.items()):
                    if owner_uid != uid and game_id in user_games:
                        if uid not in self._games:
                            self._games[uid] = {}
                        self._games[uid][game_id] = user_games.pop(game_id)
                        logger.info(
                            f"[FirebaseService] Migrated game {game_id} from {owner_uid} to {uid} during update"
                        )
                        break

            if uid not in self._games or game_id not in self._games[uid]:
                raise KeyError(f"Game {game_id} not found for user {uid}")
            self._games[uid][game_id].update(updates)
            return self._games[uid][game_id]

    def list_games_history(
        self, uid: str, page: int = 1, limit: int = 10
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self._lock:
            user_games = list(self._games.get(uid, {}).values())
            # Sort newest first
            user_games.sort(key=lambda x: x.get("startedAt") or datetime.min, reverse=True)
            total = len(user_games)
            start = (page - 1) * limit
            end = start + limit
            return user_games[start:end], total


class FirestoreDatabaseService(BaseDatabaseService):
    """Google Cloud Firestore implementation following the project plan collection model."""

    def __init__(self, client: firestore.firestore.Client) -> None:
        self.db = client
        logger.info("[FirebaseService] Initialized Firestore client connection.")

    def _user_ref(self, uid: str):
        return self.db.collection("users").document(uid)

    def _games_collection(self, uid: str):
        return self._user_ref(uid).collection("games")

    def get_or_create_user(
        self, uid: str, email: Optional[str] = None, display_name: Optional[str] = None
    ) -> Dict[str, Any]:
        doc_ref = self._user_ref(uid)
        snapshot = doc_ref.get()
        if snapshot.exists:
            return snapshot.to_dict() or {}

        initial_data = {
            "uid": uid,
            "email": email or "",
            "displayName": display_name or "",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "stats": {
                "totalGames": 0,
                "gamesWon": 0,
                "bestScore": None,
                "currentStreak": 0,
                "totalGuessesWon": 0,
                "avgGuesses": 0.0,
            },
        }
        doc_ref.set(initial_data)
        return initial_data

    def get_user_stats(self, uid: str) -> Dict[str, Any]:
        user_doc = self._user_ref(uid).get()
        if user_doc.exists:
            return user_doc.to_dict().get("stats", {})
        return self.get_or_create_user(uid).get("stats", {})

    def update_user_stats(self, uid: str, stats: Dict[str, Any]) -> None:
        self._user_ref(uid).set({"stats": stats}, merge=True)

    def create_game(self, uid: str, game_data: Dict[str, Any]) -> Dict[str, Any]:
        game_id = game_data["gameId"]
        self._games_collection(uid).document(game_id).set(game_data)
        return game_data

    def get_game(self, uid: str, game_id: str) -> Optional[Dict[str, Any]]:
        doc = self._games_collection(uid).document(game_id).get()
        if doc.exists:
            return doc.to_dict()

        # Check across collections via collection_group in case game was started before auth
        try:
            results = list(
                self.db.collection_group("games")
                .where("gameId", "==", game_id)
                .limit(1)
                .stream()
            )
            if results:
                found_doc = results[0]
                data = found_doc.to_dict()
                # Migrate document to current authenticated user
                self._games_collection(uid).document(game_id).set(data)
                try:
                    found_doc.reference.delete()
                except Exception:
                    pass
                logger.info(f"[FirestoreService] Migrated game {game_id} to user {uid}")
                return data
        except Exception as err:
            logger.debug(f"[FirestoreService] Collection group lookup fallback skipped: {err}")

        return None

    def get_active_game(self, uid: str) -> Optional[Dict[str, Any]]:
        query = (
            self._games_collection(uid)
            .where("status", "==", "IN_PROGRESS")
            .order_by("startedAt", direction=firestore.Query.DESCENDING)
            .limit(1)
        )
        docs = list(query.stream())
        if docs:
            return docs[0].to_dict()

        # Fallback check for unclaimed active game from guest/dev sessions
        for guest_uid in ["guest_user", "dev-player-1"]:
            if guest_uid != uid:
                g_query = (
                    self._games_collection(guest_uid)
                    .where("status", "==", "IN_PROGRESS")
                    .order_by("startedAt", direction=firestore.Query.DESCENDING)
                    .limit(1)
                )
                g_docs = list(g_query.stream())
                if g_docs:
                    data = g_docs[0].to_dict()
                    gid = data["gameId"]
                    self._games_collection(uid).document(gid).set(data)
                    try:
                        g_docs[0].reference.delete()
                    except Exception:
                        pass
                    logger.info(f"[FirestoreService] Claimed guest active game {gid} for user {uid}")
                    return data

        return None

    def update_game(self, uid: str, game_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        ref = self._games_collection(uid).document(game_id)
        doc = ref.get()
        if not doc.exists:
            # Trigger migration if game exists under another user
            self.get_game(uid, game_id)
        ref.update(updates)
        doc = ref.get()
        return doc.to_dict() if doc.exists else updates

    def list_games_history(
        self, uid: str, page: int = 1, limit: int = 10
    ) -> Tuple[List[Dict[str, Any]], int]:
        games_ref = self._games_collection(uid)
        # Fetch all or count
        query = games_ref.order_by("startedAt", direction=firestore.Query.DESCENDING)
        docs = list(query.stream())
        total = len(docs)
        start = (page - 1) * limit
        end = start + limit
        paginated_docs = [d.to_dict() for d in docs[start:end]]
        return paginated_docs, total


# Singleton instance holder
_db_instance: Optional[BaseDatabaseService] = None
_firebase_initialized = False


def initialize_firebase() -> BaseDatabaseService:
    """
    Initialize Firebase Admin SDK and Firestore client using:
    1. Emulator host if set
    2. serviceAccountKey.json if found
    3. Cloud Run ADC (Application Default Credentials)
    4. Fallback in-memory store for instant zero-config testing
    """
    global _db_instance, _firebase_initialized

    if _db_instance is not None:
        return _db_instance

    # Check for emulator
    emulator_host = settings.FIRESTORE_EMULATOR_HOST or os.environ.get("FIRESTORE_EMULATOR_HOST")
    auth_emulator = settings.FIREBASE_AUTH_EMULATOR_HOST or os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")

    if emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = emulator_host
        logger.info(f"[FirebaseService] Using Firestore Emulator at {emulator_host}")
    if auth_emulator:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = auth_emulator
        logger.info(f"[FirebaseService] Using Firebase Auth Emulator at {auth_emulator}")

    # Initialize Firebase Admin App if not already initialized
    try:
        if not firebase_admin._apps:
            cert_path = settings.FIREBASE_CREDENTIALS_PATH
            if cert_path and os.path.exists(cert_path):
                logger.info(f"[FirebaseService] Loading credentials from {cert_path}")
                cred = credentials.Certificate(cert_path)
                firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
            elif emulator_host:
                logger.info("[FirebaseService] Initializing app with emulator credentials")
                firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})
            else:
                try:
                    logger.info("[FirebaseService] Attempting Application Default Credentials (Cloud Run)")
                    cred = credentials.ApplicationDefault()
                    firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
                except Exception as adc_err:
                    logger.warning(f"[FirebaseService] ADC not available: {adc_err}. Initializing with project options.")
                    firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})

        _firebase_initialized = True

        if settings.USE_MOCK_DATABASE or os.environ.get("USE_MOCK_DATABASE", "").lower() in ("true", "1"):
            logger.info("[FirebaseService] USE_MOCK_DATABASE enabled. Using In-Memory Database store.")
            _db_instance = InMemoryDatabaseService()
            return _db_instance

        # Try to connect to Firestore
        firestore_client = firestore.client()
        # Verify connectivity eagerly so any auth/permission errors fall back gracefully in development
        try:
            # Limit check to 1 collection metadata query
            next(firestore_client.collections(), None)
        except Exception as conn_err:
            if settings.ENVIRONMENT == "development" or settings.DEV_BYPASS_AUTH:
                logger.warning(
                    f"[FirebaseService] Firestore cloud connection failed ({conn_err}). "
                    "Automatically falling back to In-Memory Database store for zero-friction local development."
                )
                _db_instance = InMemoryDatabaseService()
                return _db_instance
            raise conn_err

        _db_instance = FirestoreDatabaseService(firestore_client)
        logger.info("[FirebaseService] Connected to Firestore successfully.")
        return _db_instance

    except (DefaultCredentialsError, Exception) as exc:
        logger.warning(
            f"[FirebaseService] Could not establish Firestore connection ({exc}). "
            "Falling back to thread-safe In-Memory database store for zero-config local testing."
        )
        _db_instance = InMemoryDatabaseService()
        return _db_instance


def get_database_service() -> BaseDatabaseService:
    """Dependency provider for database service."""
    global _db_instance
    if _db_instance is None:
        _db_instance = initialize_firebase()
    return _db_instance


def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """Verify Firebase ID token using firebase-admin auth SDK."""
    if not firebase_admin._apps:
        initialize_firebase()
    return auth.verify_id_token(id_token)
