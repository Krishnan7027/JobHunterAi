# Backward compatibility shim — use app.core.security and app.core.dependencies instead
from app.core.security import hash_password, verify_password, create_access_token, decode_token, pwd_context, security  # noqa: F401
from app.core.dependencies import get_current_user  # noqa: F401
