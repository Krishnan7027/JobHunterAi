# Backward compatibility shim — use app.core.database instead
from app.core.database import engine, async_session, Base, get_db, init_db  # noqa: F401
