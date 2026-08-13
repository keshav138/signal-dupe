# Build Log — Signal Clone

This file tracks, per phase, what was implemented and any decisions made during the build. The canonical architecture rationale lives in `decisions.md`.

---

## Phase 1 — Scaffold + schema

**Done**
- Initialized FastAPI backend under `backend/`.
- Created SQLAlchemy models matching `PLAN.md` section 1:
  - `users`, `contacts`, `conversations`, `conversation_participants`, `messages`, `message_status`, `message_reactions`.
- Added `app/db/base.py` with `utcnow()` helper and `DeclarativeBase`.
- Added `app/db/database.py` with SQLite engine, `SessionLocal`, and `get_db` dependency.
- Added `app/core/config.py` using pydantic-settings (`.env` support).
- Added `app/core/security.py` with JWT encode/decode helpers (unused in this phase).
- Added `app/main.py` with lifespan hook that runs `Base.metadata.create_all()` and CORS middleware.

**Verified**
- `python -c "from app.main import app"` imports cleanly.
- Schema generation produced all 7 expected tables in `signal.db`.
- Server boots on `127.0.0.1:8000` and `/` returns `{"status":"ok"}`.
