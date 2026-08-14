# Signal Clone

A Signal-style messaging app: OTP-based phone auth, 1:1 and group chats, real-time delivery with read receipts, typing indicators, presence, reactions, and reply-to — built on FastAPI + Next.js.

**Live demo:** https://signal-dupe.vercel.app
**Backend:** https://signal-dupe-production.up.railway.app
**Repo:** https://github.com/keshav138/signal-dupe

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI + SQLAlchemy (SQLite for dev, Postgres on Railway) |
| Real-time | Native Starlette WebSockets, single `/ws` endpoint |
| Auth | JWT (7-day expiry, no refresh tokens), mocked OTP |
| Frontend | Next.js 16 (App Router) + TypeScript + Material UI v9 + Zustand |
| Styling | MUI theme following `signal-design-system.md` tokens |
| Migrations | None — `Base.metadata.create_all()` on startup |
| Deployment | Railway (backend + Postgres), Vercel (frontend) |

---

## Architecture Overview

Two services talk over HTTP and WebSocket:

- **REST API (FastAPI)** handles everything non-live: auth, contacts, user search, conversation/group CRUD, and paginated message history.
- **One WebSocket connection per client** (`/ws?token=<jwt>`) carries all live events: message send/delivery/read status, typing, presence, reactions, and conversation-list updates. Sending a message goes over the socket only, so there is a single source of truth for "a message was sent."

The backend keeps connected clients in an in-memory `ConnectionManager` (`user_id → WebSocket`); typing and online presence are never persisted. Message delivery state is stored per (message, recipient) in `message_status`, which drives the single/double/blue tick logic. The frontend uses a Zustand store with an embedded WebSocket client that reconciles optimistic sends via `client_temp_id`.

```
repo/
  backend/
    app/
      main.py
      core/            # config, security (JWT/OTP), auth deps
      db/              # engine, session, Base
      models/          # user, contact, conversation, message, reaction
      schemas/         # Pydantic request/response models
      routers/         # auth, contacts, conversations, messages
      ws/              # connection manager, WS router, handlers, serializers
      seed.py          # demo data, runs on empty DB startup
    railway.json
    requirements.txt
    .env.example
  frontend/
    app/               # login, register, chats, chat/[id], settings
    components/        # MUI chat UI components
    lib/               # api client, types, zustand store, theme
  BUILD_LOG.md         # per-phase build log
  decisions.md         # architecture rationale
  PLAN.md              # original build plan
```

---

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The server runs on `http://localhost:8000`. The database is SQLite (`signal.db`), created and seeded automatically on first start (7 users, contacts, 4 direct + 2 group conversations with realistic messages).

Set `DATABASE_URL` to a Postgres URL to switch databases — the URL scheme is normalized automatically (`postgres://` → `postgresql+psycopg://`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:3000`. If `npm install` skips devDependencies, check for a globally-set `NODE_ENV=production` and override it:

```bash
set NODE_ENV=development && npm install
```

### Environment variables

Backend (`.env`, see `.env.example`):

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./signal.db` | Set to Postgres URL in production |
| `SECRET_KEY` | dev value | JWT signing key — set a real one in production |
| `OTP_CODE` | `123456` | The mocked verification code |
| `FRONTEND_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated CORS allowlist |

Frontend (`frontend/.env.local`):

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend origin, e.g. `https://signal-dupe-production.up.railway.app` |
| `NEXT_PUBLIC_WS_URL` | WebSocket origin (same host, `wss://` scheme) |

---

## Database Schema

| Table | Columns |
|---|---|
| `users` | id, phone_number (unique), username (unique), display_name, avatar_url, last_seen, created_at |
| `contacts` | id, owner_id → users, contact_user_id → users, nickname, created_at; unique (owner_id, contact_user_id) |
| `conversations` | id, type (direct/group), name, avatar_url, created_by, created_at, updated_at |
| `conversation_participants` | id, conversation_id, user_id, role (member/admin), last_read_message_id, joined_at; unique (conversation_id, user_id) |
| `messages` | id, conversation_id, sender_id, content, reply_to_id (self-FK), created_at |
| `message_status` | id, message_id, user_id, status (sent/delivered/read), updated_at; unique (message_id, user_id) |
| `message_reactions` | id, message_id, user_id, emoji, created_at; unique (message_id, user_id) — one reaction per user, new overwrites |

---

## API Overview

All routes except `/auth/*` require `Authorization: Bearer <jwt>`.

### REST

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register/request-otp` | `{phone_number}` → always succeeds |
| POST | `/auth/register/verify` | `{phone_number, otp, username, display_name, avatar_url?}` → `{access_token, user}` |
| POST | `/auth/login/request-otp` | `{phone_number}` |
| POST | `/auth/login/verify` | `{phone_number, otp}` → `{access_token, user}` |
| GET | `/auth/me` | Current user |
| GET | `/users/search?q=&exclude_contacts=` | Fuzzy search by username/phone/name |
| GET | `/users/lookup?username=` | Exact full-username match only (anti-enumeration) |
| GET / POST | `/contacts` | List / add contact |
| DELETE | `/contacts/{id}` | Remove contact |
| GET | `/conversations` | List with last-message preview + unread count, sorted by `updated_at` |
| POST | `/conversations/direct` | `{user_id}` → get-or-create direct chat |
| POST | `/conversations/group` | `{name, member_ids}` → create group, creator is admin |
| GET | `/conversations/{id}` | Detail with participants |
| PATCH | `/conversations/{id}` | `{name?, avatar_url?}` — admin, group only |
| POST | `/conversations/{id}/members` | `{user_id}` — admin, group only |
| DELETE | `/conversations/{id}/members/{user_id}` | Admin, group only |
| GET | `/conversations/{id}/messages?before_id=&limit=` | Paginated history with reactions + status |

### WebSocket

Endpoint: `GET /ws?token=<jwt>`. One connection per logged-in client.

**Client → Server**

```jsonc
{"type": "message:send", "conversation_id": 1, "content": "hi", "reply_to_id": null, "client_temp_id": "uuid"}
{"type": "typing:start", "conversation_id": 1}
{"type": "typing:stop", "conversation_id": 1}
{"type": "message:read", "conversation_id": 1, "last_message_id": 42}
{"type": "reaction:add", "message_id": 42, "emoji": "👍"}
{"type": "reaction:remove", "message_id": 42}
```

**Server → Client**

```jsonc
{"type": "message:new", "message": {...}, "client_temp_id": "uuid"}
{"type": "message:status", "message_id": 42, "user_id": 7, "status": "delivered"}
{"type": "typing", "conversation_id": 1, "user_id": 7, "is_typing": true}
{"type": "presence", "user_id": 7, "online": true, "last_seen": null}
{"type": "reaction:update", "message_id": 42, "reactions": [{"user_id": 7, "emoji": "👍"}]}
{"type": "conversation:update", "conversation": {...}}
```

`message:new` echoes to the sender with the same `client_temp_id` so optimistic UI can reconcile. `message:status` ticks use the worst-case aggregate across recipient rows for the sender's view.

---

## Features

- Phone-number-first auth with mocked OTP (`123456`), JWT sessions
- Contacts and unified search (chats + contacts)
- **Username lookup**: find anyone by their full unique username (must type the exact username and press Enter — no partial enumeration)
- 1:1 and group conversations; admins can add members by username, rename groups, remove members
- Real-time messaging with sent → delivered → read progression (single/double/blue ticks)
- Typing indicators and online/last-seen presence
- Reactions (one per user per message, overwrite on change) and reply-to with quoted message
- Optimistic sends with instant reconciliation
- Seed data: 7 users, contacts, 4 direct + 2 group chats with realistic history
- Settings screen with placeholder sections and connection-loss toast

---

## Assumptions / Mocked Behavior

- **OTP is always `123456`** — no real SMS.
- **No real end-to-end encryption** — message content stored as plaintext (mocked per assignment spec).
- **JWT stored in `localStorage`** and passed as `?token=` on the WebSocket URL (browser WS handshakes can't carry custom headers). Long 7-day expiry, no refresh tokens.
- **No database migrations** — SQLite/Postgres schema created via `create_all()`; seed data auto-loads on an empty database.
- **Typing and presence are never persisted** — in-memory only; `last_seen` is written on disconnect.
- Time-boxed out: attachments, dark mode, disappearing messages, real encryption. See `decisions.md` for full rationale.
