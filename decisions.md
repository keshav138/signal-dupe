# Decisions — Signal Clone Assignment

## Time Budget & Scope
- ~6–10 hours available today.
- All Core (Must-Have) features are in scope: auth, contacts, 1:1 messaging, group messaging, real-time delivery, read receipts, typing indicators.
- Bonus scope is deliberately narrow: **reactions + reply-to/quoted messages only.**
- Explicitly cut for time: attachments, dark mode, disappearing messages. These are optional bonus items in the spec, not part of the officially-sanctioned "mocked/placeholder" list (calls, stories, linked devices, E2E), so instead of building fake "Coming Soon" screens for them, the README will state plainly they were time-boxed out. This is more honest than padding the UI with placeholders for things not asked to be mocked.
- Voice/video calls, stories, linked devices, real E2E crypto → simple "Coming Soon" placeholders, as explicitly sanctioned by the assignment.

## Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI + SQLAlchemy + SQLite | Native async WebSocket support in one framework, no extra socket.io dependency. Spec explicitly allows Python FastAPI. |
| Real-time | Native Starlette WebSockets, single `/ws` endpoint | Spec allows "any real-time mechanism"; one connection per client is simplest to manage and debug under time pressure. |
| Frontend | Next.js (App Router) + TypeScript + Zustand + Tailwind | Zustand over react-query/redux — less boilerplate, no cache-invalidation logic to write for a single-user-session app. Tailwind for speed matching Signal's flat, utility-driven look. |
| Migrations | None — `Base.metadata.create_all()` on startup | SQLite file is disposable and reseeded on each deploy/demo; Alembic adds setup overhead with zero payoff for a one-shot assignment build. |
| Deployment | Railway (backend) + Vercel (frontend) | Both support WebSockets. Render's free-tier web services spin down after 15 min idle, causing a 30–50s stall on the *first* click during evaluation — a real risk for a graded demo link. Railway doesn't have that per-request cold-start pattern. Vercel has first-class Next.js support. |

## Auth Flow (mocked, per spec)
- **Register**: `phone_number` → request-otp (always "succeeds," fixed code `123456`) → verify `{otp, username, display_name, avatar_url}` → user created → JWT issued.
- **Login**: `phone_number` → request-otp → verify `{otp}` → JWT issued.
- No passwords — matches "verification can be mocked with fixed OTP," and phone-number-first mirrors Signal's actual UX (vs. a generic username/password form, which would look less like Signal).
- **Token storage**: JWT in `localStorage`, sent as `Authorization: Bearer <token>`. WebSocket handshake can't carry custom headers from a browser, so the token is passed as `?token=` on the `/ws` connection URL instead.
  - *Trade-off*: httpOnly cookies are more secure against XSS, but cross-origin cookies (Vercel domain ↔ Railway domain) need `SameSite=None; Secure` plus `credentials: 'include'` on every fetch, which is extra plumbing for a mocked-auth assignment. Documented and accepted.
- No refresh tokens — access token has a long-ish expiry (e.g. 7 days); re-login on expiry is acceptable for this scope.

## Data Model Choices
- **Typing indicators & online presence are never persisted.** They live only in an in-memory `ConnectionManager` (`user_id -> WebSocket`) and are pushed live. Writing ephemeral state to SQLite would be wasted I/O for data nobody needs once the socket closes.
- **`last_seen` is persisted** on the `users` table (updated on disconnect) so offline users still show a meaningful "last seen" instead of nothing.
- **`message_status` is a separate per-(message, recipient) table**, not a column on `messages`. A single status column can't represent "read by 2 of 4 group members" — the per-recipient table can, and it's what drives the single/double/blue tick logic:
  - On send → a `sent` row is inserted for every other participant.
  - If a recipient is currently connected → their row flips to `delivered` immediately, broadcast to sender.
  - When a recipient opens that conversation → client emits `message:read` → their row(s) flip to `read`.
  - The tick shown to the sender is the *worst-case* aggregate across all recipient rows for that message (1:1 = the one row; group = "read" only once everyone has read).
- **Reactions**: one reaction per user per message (matches Signal's actual behavior — a new reaction from the same user replaces, not stacks).
- **Reply-to**: self-referential FK on `messages` (`reply_to_id`), not a separate table — a reply is just a message with a pointer.
- **Contacts** table is separate from `users`: it's an edge (owner → contact_user), not a property of a user, since two users can each "add" the other independently and it needs to support nicknames later without touching the `users` row.

## WebSocket Protocol
Single endpoint: `/ws?token=<jwt>`. Every frame is JSON: `{"type": "...", ...payload}`.

**Client → Server**: `message:send`, `typing:start`, `typing:stop`, `message:read`, `reaction:add`, `reaction:remove`.
**Server → Client**: `message:new`, `message:status`, `typing`, `presence`, `reaction:update`, `conversation:update` (bumps conversation to top of list on new activity).

REST is used for everything that isn't a live push: history pagination, contact/user search, conversation/group CRUD, auth. Sending a message goes over the socket only, so there's a single source of truth for "a message was sent" instead of racing a POST against a broadcast.

## Explicitly Out of Scope
- Real end-to-end encryption (mocked per spec — content stored as plaintext, with a cosmetic "encrypted" flag if time allows).
- Attachments, dark mode, disappearing messages, keyboard shortcuts.
- Refresh tokens, rate limiting, formal migrations, automated tests (given the time budget; manual smoke-test checklist used instead).
