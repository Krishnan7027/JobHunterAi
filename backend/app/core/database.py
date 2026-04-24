import ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

_url = settings.async_database_url
_is_postgres = _url.startswith("postgresql")

_engine_kwargs = {"echo": False}
if _is_postgres:
    _ssl_ctx = ssl.create_default_context()
    _engine_kwargs.update(
        pool_pre_ping=True, pool_size=5, max_overflow=10,
        connect_args={"ssl": _ssl_ctx},
    )

engine = create_async_engine(_url, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
