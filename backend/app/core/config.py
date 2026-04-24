import os
import tempfile

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI Job Hunter"
    database_url: str = "sqlite+aiosqlite:///./job_hunter.db"
    upload_dir: str = os.path.join(tempfile.gettempdir(), "job_hunter_uploads")
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    max_jobs_per_fetch: int = 50
    scrape_delay: float = 2.0
    frontend_url: str = "http://localhost:3000"

    rate_limit_default: float = 1.0
    rate_limit_google: float = 0.5
    rate_limit_indeed: float = 1.0
    rate_limit_naukri: float = 1.0

    gemini_rpm_limit: int = 14
    gemini_requests_per_minute: float = 14.0

    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    @property
    def async_database_url(self) -> str:
        """Convert DATABASE_URL to async driver URL."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
