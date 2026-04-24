"""Profile module service layer."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.profile.models import Profile


class ProfileService:
    """Thin service layer for profile operations."""

    async def get_profile_by_user(self, db: AsyncSession, user_id: int) -> Profile | None:
        """Get a user's profile, or None if not found."""
        result = await db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create_profile(
        self, db: AsyncSession, user_id: int, username: str, email: str
    ) -> Profile:
        """Get existing profile or auto-create an empty one."""
        profile = await self.get_profile_by_user(db, user_id)
        if not profile:
            profile = Profile(
                user_id=user_id,
                name=username,
                email=email,
            )
            db.add(profile)
            await db.commit()
            await db.refresh(profile)
        return profile

    async def update_profile(
        self, db: AsyncSession, user_id: int, update_data: dict
    ) -> Profile:
        """Update profile fields. Creates profile if missing."""
        result = await db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()

        if not profile:
            profile = Profile(user_id=user_id)
            db.add(profile)

        for field, value in update_data.items():
            setattr(profile, field, value)

        await db.commit()
        await db.refresh(profile)
        return profile


profile_service = ProfileService()
