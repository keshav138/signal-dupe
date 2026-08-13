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

---

## Phase 3 — Contacts + user search

**Done**
- Added `app/schemas/contact.py` (contact create/out models).
- Added `app/routers/contacts.py` with:
  - `GET /users/search?q=&exclude_contacts=` — matches username/phone/display name, excludes self, optional exclude existing contacts.
  - `GET /contacts` — list with joined contact user info.
  - `POST /contacts` — add contact (rejects self, duplicates, missing users).
  - `DELETE /contacts/{id}` — remove own contact.
- Added `Contact.contact_user` relationship (needed for `joinedload`).
- Registered contacts router in `app/main.py`.

**Verified**
- User search returns Bob when Alice searches, returns `[]` when searching self (`alice`).
- `exclude_contacts=true` hides existing contacts.
- Add contact works; duplicate add returns 400; delete returns `{"message":"Contact removed"}`.

---

## Phase 4 — Conversations

**Done**
- Added `app/schemas/conversation.py` (list item, detail, create/update/member models).
- Added `app/routers/conversations.py` with:
  - `POST /conversations/direct` — get-or-create direct chat between current user and target.
  - `POST /conversations/group` — create group with members, creator as admin.
  - `GET /conversations` — list sorted by `updated_at` desc, with last message preview, unread count, and `other_user` for direct chats.
  - `GET /conversations/{id}` — detail with participants.
  - `PATCH /conversations/{id}` — update name/avatar (admin only, group only).
  - `POST /conversations/{id}/members` — add member (admin only, group only).
  - `DELETE /conversations/{id}/members/{user_id}` — remove member (admin only, group only).
- Added `Conversation.participants` and `ConversationParticipant.user` relationships.
- Registered conversations router in `app/main.py`.

**Verified**
- Direct get-or-create returns same conversation on repeat.
- Group create with 3 members; creator is admin.
- List returns group first (most recent) and direct second, with `other_user` for direct.
- Non-admin member add → 403; admin add/remove works; group name PATCH works.
