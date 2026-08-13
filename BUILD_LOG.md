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

---

## Phase 2 — Auth

**Done**
- Added `app/schemas/auth.py` and `app/schemas/user.py` (Pydantic request/response models).
- Added `app/core/deps.py` with `get_current_user` dependency (HTTPBearer + JWT decode).
- Added `app/routers/auth.py` with:
  - `POST /auth/register/request-otp` — rejects already-registered numbers.
  - `POST /auth/register/verify` — checks fixed OTP, uniqueness of phone/username, creates user, returns JWT + user.
  - `POST /auth/login/request-otp` — rejects unregistered numbers.
  - `POST /auth/login/verify` — checks fixed OTP, returns JWT + user.
  - `GET /auth/me` — returns current user from bearer token.
- Registered the auth router in `app/main.py`.

**Verified**
- Register OTP request → `{"message":"OTP sent to +15550001111"}`.
- Register verify with `123456` → returns `access_token` and user object.
- `/auth/me` with token → returns user; without token → HTTP 401.
- Login OTP request + verify → returns JWT + user.
