# Project Assumptions & Notes — Signal Clone

## Mocked / Simulated Behavior

- **OTP is always `123456`** — no real SMS is sent. `/auth/register/request-otp` and `/auth/login/request-otp` always "succeed" after validating the phone number.
- **No real end-to-end encryption** — messages are stored as plaintext in the database. Encryption is mocked per assignment spec (the spec explicitly allows mocking verification and security).
- **No refresh tokens** — JWTs have a 7-day expiry; re-login after expiry is acceptable for this scope.
- **Token storage** — JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>` for REST. WebSocket handshakes can't carry custom headers from a browser, so the token is passed as `?token=<jwt>` on the `/ws` URL instead of httpOnly cookies (which would require SameSite=None + Secure plumbing across two domains).
- **Typing indicators and online presence are never persisted** — they live only in an in-memory `ConnectionManager` (`user_id → WebSocket`) and are pushed live. `last_seen` *is* persisted on the users table, updated on disconnect.
- **One WebSocket connection per user** — a new connection replaces the old one (the old socket is closed with code 4000), and a replaced socket does not broadcast a false "offline" presence.

## Data & Seed

- **Database**: SQLite locally (`backend/signal.db`), Postgres in production (Railway). Schema is created with `Base.metadata.create_all()` on startup — no migrations.
- **Auto-seeding**: if the users table is empty on startup, demo data is inserted: 7 users (alice, bob, carol, dave, eve, frank, grace) with pravatar avatar URLs, most mutually connected as contacts, 4 direct conversations (8–17 messages each, spread over the last 3 days, mixed read/delivered statuses), and 2 group chats ("The Crew", "Weekend Plans") with multi-sender messages, one reply-to, and reactions. Alice has unread messages from Bob (2) and Eve (1) so the UI shows badges on first load.
- **Demo logins**: any seeded user's phone number + `123456`, e.g. `+15550001111` (Alice).

## Architecture Notes

- **REST for non-live operations** (auth, contacts, search, conversation/group CRUD, paginated history); **WebSocket for everything live** (message send, delivery/read status, typing, presence, reactions, conversation list updates).
- **Messages are sent over the socket only** — no POST send endpoint — so there is a single source of truth for "a message was sent."
- **Read receipts use a per-(message, recipient) `message_status` table** — a single status column can't represent "read by 2 of 4 group members." The tick shown to the sender is the worst-case aggregate across all recipient rows.
- **Reactions**: one reaction per user per message; a new reaction from the same user replaces the old one (matches Signal's actual behavior).
- **Reply-to**: self-referential `reply_to_id` FK on `messages` — a reply is just a message with a pointer.
- **Username lookup is anti-enumeration**: `GET /users/lookup?username=` does an exact full-username match only (case-insensitive). No partial/substring matching, and the UI fires the lookup only on Enter after the full username is typed.
- **Message status progression**: sent → delivered (recipient connected) → read (recipient opens the conversation or sends `message:read`).

## Explicitly Out of Scope (time-boxed)

- Attachments/media upload, dark mode, disappearing messages, keyboard shortcuts.
- Real E2E encryption, rate limiting, formal DB migrations, automated test suite (manual smoke-test checklist was used instead — 32 checks on the backend, plus browser + WS client tests for the frontend).
- Voice/video calls, stories, linked devices, real crypto → "Coming Soon" placeholders, as sanctioned by the assignment.

## Deployment Notes

- **Backend**: Railway with linked Postgres; `DATABASE_URL` is auto-normalized (`postgres://` → `postgresql+psycopg://`); CORS allows the Vercel origin via `FRONTEND_ORIGINS`.
- **Frontend**: Vercel; `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` point at the Railway domain.
- Local dev remains fully functional with SQLite + `npm run dev` / `uvicorn --reload`.

## Design

- Visual language follows `signal-design-system.md`: Signal Blue `#3A76F0`, Inter font, pill buttons, circular avatars, ~18px bubble radius with 6px tail, flat/calm UI, muted status colors, no celebratory animation.
- Frontend is built on **Material UI v9** components with a custom Signal-palette theme (per the "use pre-made component libraries" directive).
