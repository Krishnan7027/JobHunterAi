"""Legacy cache shim — delegates to app.core.cache."""

from app.core.cache import CacheManager, cache_manager

__all__ = ["CacheManager", "cache_manager"]
