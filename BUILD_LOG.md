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

---

## Phase 5 — Messaging core over WebSocket

**Done**
- Added `app/ws/connection_manager.py` — in-memory `dict[user_id, WebSocket]` registry with connect/disconnect/send/broadcast helpers; replaces old connections on reconnect.
- Added `app/ws/serializers.py` — message serialization (sender, reply_to, reactions, status from viewer's perspective), conversation list item serialization for `conversation:update` broadcasts.
- Added `app/ws/handlers.py` — server-side handlers:
  - `message:send` — insert message, insert `sent` status rows for all other participants, bump `updated_at`, broadcast `message:new` (with `client_temp_id`) + `conversation:update` to all participants; flip connected recipients' status to `delivered` and notify sender.
  - `message:read` — flip unread rows to `read` up to `last_message_id`, update `last_read_message_id`, notify each sender.
- Added `app/ws/ws_router.py` — `/ws?token=<jwt>` endpoint; validates token, registers in manager, broadcasts presence on connect/disconnect, routes client events to handlers.
- Added `app/routers/messages.py` — `GET /conversations/{id}/messages?before_id=&limit=` with cursor pagination.
- Presence fix: newly connected clients receive presence events for peers already online.

**Verified** (two Python `websockets` clients, Alice + Bob)
- Bob receives `presence` when Alice connects.
- Alice sends message → gets `message:new` echo with `client_temp_id` and `message:status delivered` (Bob connected).
- Bob receives `message:new` + `conversation:update` with `unread_count=1`.
- Bob sends `message:read` → Alice receives `message:status read`.
- History pagination: `before_id` returns earlier messages; full list returns correct statuses (`read`, `delivered`).

---

## Phase 6 — Group messaging

**Done**
- No new server code needed — the Phase 5 handlers already loop over all participants. This phase verified the multi-recipient flow end to end.

**Verified** (three Python `websockets` clients: Alice, Bob, Carol in group #2)
- Alice's group message reaches both Bob and Carol with the same message id.
- Alice receives `message:status delivered` for both recipients.
- Bob sends `message:read` → Alice receives `message:status read` from Bob.
- Bob's message reaches Alice and Carol.
- History endpoint returns the group messages with correct worst-case status for the sender's view.

---

## Phase 7 — Reactions + reply-to

**Done**
- No new server code — reaction and reply handlers were written in Phase 5 (`handle_reaction_add/remove`, `reply_to_id` in `handle_message_send`). This phase verified them.

**Verified** (two Python `websockets` clients)
- Reaction add → both participants receive `reaction:update` with full reaction list.
- Same user reacting again overwrites (Signal behavior) — one reaction per user.
- Two users can react to the same message; remove deletes the row and broadcasts updated list.
- Reply-to: sending with `reply_to_id` returns the quoted message payload (`reply_to.content`, `reply_to.sender_id`) in both `message:new` and the history endpoint.
- History includes `reactions` on each message.

---

## Phase 8 — Typing indicators + presence

**Done**
- No new server code — typing and presence were implemented in Phase 5. This phase verified them.

**Verified** (two Python `websockets` clients)
- `typing:start` → other participant receives `typing {is_typing: true}`; sender does NOT receive their own typing event.
- `typing:stop` → other participant receives `typing {is_typing: false}`.
- Disconnect → peer receives `presence {online: false, last_seen: <timestamp>}`; `last_seen` persisted on the users table.
- Reconnect → peer receives `presence {online: true}`.

---

## Phase 9 — Seed script

**Done**
- Added `app/seed.py`:
  - 7 users with realistic names, phone numbers, pravatar avatar URLs.
  - Most users mutually connected as contacts (one pair deliberately not connected).
  - 4 direct conversations with 8–17 messages each, timestamps spread over the last 3 days.
  - 2 group conversations ("The Crew" 4 members, "Weekend Plans" 4 members) with multi-sender messages, one reply-to, and reactions.
  - Mixed statuses: alice–bob direct has 2 unread (from bob), alice–eve has 1 unread (from eve).
  - Reply-to resolved via a per-conversation id map (fixed a bug where Python `id(convo)` was reused across GC'd objects).
  - Runs automatically on startup when the users table is empty (`seed_if_empty`), or manually via `python -m app.seed` (wipes and reseeds).

**Verified**
- Conversation list shows correct previews, unread counts, and sort order.
- The Crew history contains one reply-to with quoted message and two reactions on the right messages.
- Contacts list for alice shows 6 contacts.
- App stays functional after reseed (register/login works).

---

## Phase 10 — Backend smoke test pass

**Done**
- Wrote and ran a comprehensive smoke test covering the entire backend checklist on a fresh seeded DB (scratchpad, not committed):
  - Auth: register (request-otp, verify, duplicate rejection), login, `/auth/me` with/without token.
  - Contacts: search, self-exclusion, `exclude_contacts`, add/list/remove.
  - Conversations: direct get-or-create, group create with admin role, list with previews, non-admin PATCH rejected, admin PATCH, member add/remove.
  - Messaging WS: direct send echo + delivered, `message:new` to recipient, read receipts, group message to second client, history pagination and reactions field.
  - Reactions + reply-to: add/remove broadcast, reply payload includes quoted message.
  - Typing + presence: start/stop reaches other client, offline presence on disconnect with `last_seen`.

**Verified**
- All 32 checks passed.

---

## Phase 11 — Frontend: auth screens

**Done**
- Scaffolded Next.js 16 (App Router) + TypeScript + Tailwind 4 + Zustand frontend under `frontend/`.
- Design tokens in `app/globals.css` per `signal-design-system.md`: Signal Blue `#3A76F0`, light grays, pill buttons, ~18px radius, system font stack, 200ms transitions.
- `lib/types.ts` — TS types mirroring backend payloads (User, Contact, Conversation, Message, WsEvent).
- `lib/api.ts` — fetch wrapper attaching Bearer token from localStorage; `ApiError` with backend detail; `wsUrl()` helper.
- `lib/store.ts` — Zustand store: auth state, `init()` restoring session from token, conversation list with `upsertConversation`, WS event reducer hook.
- `components/OtpInput.tsx` — 6-digit OTP boxes with focus ring and hint.
- `components/AuthFlow.tsx` — phone entry → OTP screen (hint `123456`) → profile setup for register; direct to app for login. Inline calm error banners per design system.
- Routes: `/login`, `/register` under `(auth)` group; `/` redirects based on auth; `/chats` placeholder for the next phase.

**Verified**
- `tsc --noEmit` passes.
- All three routes return 200 and render (login HTML contains AuthFlow with `mode:"login"`).
- Backend healthy at `/` for the login → verify round trip.

**Note**: `agent-browser` not installed — browser-level click-through deferred; user can visually verify at http://localhost:3000/login with both servers running.

---

## Phase 12 — Frontend: shell + conversation list (MUI rebuild)

**Decisions**
- Switched from hand-rolled Tailwind components to **Material UI v9** (`@mui/material`, `@mui/icons-material`, `@emotion/*`) per user directive to use pre-made component libraries comprehensively for speed.
- Kept the `signal-design-system.md` tokens (Signal Blue `#3A76F0`, pill buttons, circular avatars, 18px radius) as the MUI theme.
- Inter font via `@fontsource/inter`.

**Done**
- `lib/theme.tsx` — MUI theme with Signal palette, pill buttons, Inter typography; wraps the app in ThemeProvider + CssBaseline.
- `components/AuthFlow.tsx` — rebuilt on MUI (Paper, TextField, Button, Alert, Stack) with the same phone → OTP → profile flow.
- `components/MainShell.tsx` — two-pane shell: left 320px list pane, right chat pane.
- `components/ConversationList.tsx` — AppBar header with user avatar, search TextField filtering both conversations and contacts (unified search per design system).
- `components/ConversationListItem.tsx` — MUI ListItemButton rows with UserAvatar (initials fallback on deterministic color), bold title, timestamp, preview, unread Badge.
- `components/EmptyChatPane.tsx` — calm empty state with chat icon.
- Routes: `/chats` (list + empty pane), `/chat/[id]` (placeholder until Phase 13), `/login`, `/register`, `/` (auth redirect).

**Verified** (agent-browser, production build)
- Conversation list renders 5 seeded conversations with avatars, previews, timestamps, unread badges (Bob=2, Eve=1).
- Search "bob" shows both contact match and conversation.
- Clicking Bob navigates to `/chat/1`.
- `tsc --noEmit` and `next build` pass.

**Note**: Dev-mode Turbopack had stale chunk issues; production build (`npm run build && npm run start`) verified working — dev-mode only used for future debugging.

---

## Phases 13–17 — Chat experience block (MUI)

**Decisions**
- User directive: build fast with pre-made component libraries (MUI v9), don't compromise on functionality. Batched the five frontend phases into one block.
- Store rewrite embeds the WebSocket client directly (replaces the hook file) — one connection, auto-reconnect with heartbeat, status tracking.

**Done**
- `lib/store.ts` — full chat state: per-conversation messages, typing, presence, optimistic sends with `client_temp_id` reconciliation, read receipts, reactions, reply-to, group creation, contact actions; auto-reconnect WS with 1.5s backoff + 30s heartbeat.
- `components/ChatWindow.tsx` — header with avatar, title, online/last-seen (direct) or member count (group), kebab menu, members dialog trigger.
- `components/MessageList.tsx` — date separators, infinite scroll up (`before_id` pagination), smooth scroll to bottom on new messages.
- `components/MessageBubble.tsx` — Signal palette (blue sent/white received), ✓/✓✓/blue-✓✓ status ticks, reply quote card, inline reaction chips, hover menu with Reply + 6 emoji reactions (toggle to remove).
- `components/MessageInput.tsx` — multiline composer, Enter to send (Shift+Enter newline), typing debounce (2s stop), reply preview bar with cancel.
- `components/TypingIndicator.tsx` — animated dots + "X is typing" (handles 1/2/N names).
- `components/GroupCreateModal.tsx` — MUI Dialog with group name + contact multi-select checkboxes.
- `components/GroupMembersModal.tsx` — member list with admin badge, admin can remove members (calls backend, revalidates).
- `components/SettingsPane.tsx` — profile card, 6 placeholder sections with "Coming Soon", logout; `ConnectionToast` snackbar on WS loss.
- Routes: `/chat/[id]` (real ChatWindow), `/settings`; conversation list got new-group button + clickable user avatar → settings; search contacts now clickable to start direct chats.

**Verified** (agent-browser browser session as Alice + Python `websockets` client as Bob, production build)
- Bob's message appears live in the browser; unread badge bumps then clears.
- Alice's message sent from browser reaches Bob; Bob reacts ❤️ → reaction chip renders on the right bubble in the browser.
- Read receipts: Alice's messages show `read` in store after Bob marks read; optimistic temp IDs reconciled to real message IDs.
- Typing: Bob's `typing:start` renders "Bob Smith is typing" in the browser; clears on stop.
- Settings page renders profile + all sections + logout.
- `tsc --noEmit` and `next build` pass.

---

## Fixes — connection loop, bubbles, reply, unread badges

**Root causes + fixes**
1. **"Connection lost — reconnecting" loop** — my headless agent-browser test session was still logged in as Alice and holding the single WS slot, so my hidden browser and the user's browser kept kicking each other off (backend allows one connection per user). Closed all headless sessions; also hardened both sides:
   - Backend: replaced sockets no longer broadcast a false "offline" presence; `manager.is_active(user.id, ws)` guard before disconnect broadcast.
   - Frontend: reconnect backoff with jitter (1.5–3.5s), heartbeat interval cleared/reset on reopen, full state re-sync (`loadConversations` + active convo) on every WS open.
2. **Bubble corners too round** — MUI numeric `borderRadius` multiplies the theme value; theme `shape.borderRadius` was 18px so `borderRadius: 2.5` rendered 45px pills. Fixed with explicit `"18px"` (tail `"6px"`) on bubbles, `"12px"` on reply quotes/composer bar, theme default now 8px.
3. **Reply hard to find** — was hover-only tiny icon. Now: visible Reply + React icons on hover AND a right-click context menu on every message with Reply + 6 emoji reactions.
4. **Unread badge not clearing without reload** — backend `message:read` now broadcasts `conversation:update` to all participants (reader included), so badges clear live; frontend also zeroes the badge locally the moment a conversation is opened.

**Verified**
- Python WS test: `message:read` → `conversation:update` with `unread_count: 0` broadcast to reader.
- Vision check of screenshot: bubble corners are rounded rectangles (not pills), sent=blue/white, received=white/dark, blue double-ticks on read messages.
- `tsc --noEmit` + production build pass; frontend + backend restarted with fixes.

---

## Fix — reply quote invisible on sender's own bubble

**Root cause**
- The sender's own reply bubble rendered the quote box with `rgba(255,255,255,0.25)` background and white text — invisible against the white chat background. (The DOM had the quote, but it was white-on-white.)
- Additionally, the optimistic message was created with `reply_to: null`, so the quote only appeared after the server echo reconciled — and for the sender's own bubble the quote box was invisible anyway.

**Fix**
- Optimistic messages now resolve the quoted message locally (`reply_to_id` → full quote object from the local message list), so the quote shows instantly on send.
- Reply quote box restyled: light Signal-blue tint `rgba(58,118,240,0.12)` with blue left border and dark text — visible on both own and received bubbles.

**Verified**
- Store check: optimistic reply message has full `reply_to` object with quoted content before any server echo.
- DOM trace + vision screenshot: the "fixed reply flow" blue bubble shows a visible quote box ("You" + "Hi") with blue left border above the message text.

---

## Feature — username-based user discovery + group add

**Requirement**
- Fresh account (e.g. `kshv` / Keshav Maiya) can find Alice Johnson by her unique username without knowing her number, then chat with her.
- Lookup must only happen after typing the FULL username and pressing Enter — no incremental brute-forcing via partial letters.
- Once chatting, Alice can add kshv to groups.

**Done**
- Backend: `GET /users/lookup?username=` — exact full-username match only (`func.lower(User.username) == username.strip().lower()`), excludes self, 404 otherwise. No partial/substring matching = no enumeration.
- Frontend store: `lookupUserByUsername` action calling the endpoint, returning null on 404.
- ConversationList: search box fires the lookup ONLY on Enter; shows "Press Enter to find someone by their full username" hint; result renders as "Alice Johnson @alice — press to start chatting"; typing again invalidates the previous lookup. Not-found state shows a calm message.
- GroupMembersModal: admins get an "Add someone by username (press Enter)" input using the same exact lookup; adding calls `POST /conversations/{id}/members` and refreshes the member list.

**Verified**
- API: `username=ali` → 404 (partial rejected); `username=alice` (self) → 404; `username=bob` → 200.
- Browser (two sessions): registered fresh `kshv`, typed `al` → no results before Enter, `alice` + Enter → Alice appears, clicked → direct chat created, message sent and visible on Alice's side.
- Alice opened The Crew → members modal → typed `kshv` + Enter → "Member added", group went 4 → 5 members with Keshav Maiya listed; kshv's chat list now shows The Crew.

---

## Prep — Postgres-ready DB config

**Done**
- `app/db/database.py`: SQLite branch keeps `check_same_thread=False`; anything else (Postgres) gets `pool_pre_ping=True` — selected via `DATABASE_URL`.
- `requirements.txt`: added `psycopg[binary]` for Postgres on Railway.
- `.env.example`: documents the production `DATABASE_URL` format (`postgresql+psycopg://...`).
- Local dev default unchanged: SQLite file.

**Note**
- Railway gives a Postgres URL with `postgres://` scheme — SQLAlchemy 2.x requires `postgresql+psycopg://`. Railway's dashboard shows a "Postgres URL" that already uses `postgresql://` in most cases; if it starts with `postgres://`, replace the prefix with `postgresql+psycopg://` when setting the env var.
