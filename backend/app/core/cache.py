"""In-memory caching layer with TTL support.

Replaces diskcache for cloud deployment (no persistent disk needed).
"""

import hashlib
import logging
import time
from threading import Lock

logger = logging.getLogger(__name__)


class CacheManager:
    """Thread-safe in-memory cache with TTL support."""

    def __init__(self, max_size: int = 1000) -> None:
        self._store: dict[str, tuple[str, float]] = {}
        self._max_size = max_size
        self._lock = Lock()

    def get(self, key: str) -> str | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at and time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: str, expire: int = 3600) -> None:
        with self._lock:
            if len(self._store) >= self._max_size:
                self._evict_expired()
            expires_at = time.time() + expire if expire else 0
            self._store[key] = (value, expires_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def _evict_expired(self) -> None:
        """Remove expired entries. Called under lock."""
        now = time.time()
        expired = [k for k, (_, exp) in self._store.items() if exp and now > exp]
        for k in expired:
            del self._store[k]
        if len(self._store) >= self._max_size:
            oldest = sorted(self._store.items(), key=lambda x: x[1][1])[:len(self._store) // 4]
            for k, _ in oldest:
                del self._store[k]

    @staticmethod
    def hash_key(*parts: str) -> str:
        combined = "|".join(str(p) for p in parts)
        return hashlib.sha256(combined.encode()).hexdigest()[:32]

    def close(self) -> None:
        self.clear()


cache_manager = CacheManager()
