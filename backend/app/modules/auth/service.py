"""Auth business logic: register and login."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_access_token
from app.core.models import User


class AuthService:
    async def register(self, db: AsyncSession, username: str, email: str, password: str) -> dict:
        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

        existing_email = await db.execute(select(User).where(User.email == email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

        user = User(username=username, email=email, password_hash=hash_password(password))
        db.add(user)
        await db.commit()
        await db.refresh(user)

        token = create_access_token({"sub": str(user.id), "username": user.username})
        return {"access_token": token, "token_type": "bearer", "user_id": user.id, "username": user.username}

    async def login(self, db: AsyncSession, username: str, password: str) -> dict:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

        token = create_access_token({"sub": str(user.id), "username": user.username})
        return {"access_token": token, "token_type": "bearer", "user_id": user.id, "username": user.username}


auth_service = AuthService()
