# Backward compatibility shim — use app.modules.*.models instead
from app.core.models import User  # noqa: F401
from app.modules.profile.models import Profile, SkillGap  # noqa: F401
from app.modules.jobs.models import Job, Application, job_contacts, Platform, ApplicationStatus  # noqa: F401
from app.modules.contacts.models import Contact, ExtractionType  # noqa: F401
from app.modules.outreach.models import OutreachMessage  # noqa: F401
