# Build Plan — Signal Clone (SDE Fullstack Assignment)

Read `decisions.md` alongside this file for rationale. This file is the operational spec — follow it exactly; don't re-decide architecture choices already made.

**Order of work: full backend (schema → auth → contacts → conversations → messaging/WS → reactions/reply-to → seed data → smoke test) BEFORE any frontend UI work. UI is the last phase.**

---

## 0. Repo Structure

```
repo/
  backend/
    app/
      main.py
      core/
        config.py
        security.py        # JWT encode/decode, OTP mock
      db/
        database.py         # engine, SessionLocal, get_db dependency
        base.py              # Base = declarative_base()
      models/
        user.py
        contact.py
        conversation.py
        message.py
        reaction.py
      schemas/
        auth.py
        user.py
        contact.py
        conversation.py
        message.py
      routers/
        auth.py
        users.py
        contacts.py
        conversations.py
        messages.py
      ws/
        connection_manager.py
        ws_router.py
        handlers.py
      seed.py
    requirements.txt
    .env.example
  frontend/
    app/
      (auth)/login/page.tsx
      (auth)/register/page.tsx
      (main)/layout.tsx        # conversation list + chat pane shell
      (main)/chat/[id]/page.tsx
      (main)/settings/page.tsx
    components/
      ConversationList.tsx
      ConversationListItem.tsx
      ChatWindow.tsx
      MessageBubble.tsx
      MessageInput.tsx
      TypingIndicator.tsx
      ContactSearchModal.tsx
      GroupCreateModal.tsx
      GroupMembersModal.tsx
      Avatar.tsx
      ReactionPicker.tsx
    lib/
      api.ts        # fetch wrapper, attaches Bearer token
      ws.ts          # WebSocket client, typed event emitter
      store.ts       # Zustand store (auth, conversations, messages, presence)
      types.ts
    package.json
  README.md
  decisions.md
```

---

## 1. Database Schema (SQLAlchemy models, SQLite)

### users
| column | type | notes |
|---|---|---|
| id | int PK | |
| phone_number | str, unique, indexed | |
| username | str, unique, indexed | |
| display_name | str | |
| avatar_url | str, nullable | |
| last_seen | datetime, nullable | updated on WS disconnect |
| created_at | datetime | default now |

### contacts
| column | type | notes |
|---|---|---|
| id | int PK | |
| owner_id | FK users.id | |
| contact_user_id | FK users.id | |
| nickname | str, nullable | |
| created_at | datetime | |
| — unique constraint (owner_id, contact_user_id) |

### conversations
| column | type | notes |
|---|---|---|
| id | int PK | |
| type | enum('direct','group') | |
| name | str, nullable | group name only |
| avatar_url | str, nullable | |
| created_by | FK users.id | |
| created_at | datetime | |
| updated_at | datetime | bumped on every new message → drives list sort order |

### conversation_participants
| column | type | notes |
|---|---|---|
| id | int PK | |
| conversation_id | FK conversations.id | |
| user_id | FK users.id | |
| role | enum('member','admin') default 'member' | admin only meaningful for groups; direct convo creator gets 'admin' but it's unused |
| last_read_message_id | FK messages.id, nullable | used to compute unread count |
| joined_at | datetime | |
| — unique constraint (conversation_id, user_id) |

### messages
| column | type | notes |
|---|---|---|
| id | int PK | |
| conversation_id | FK conversations.id, indexed | |
| sender_id | FK users.id | |
| content | text | |
| reply_to_id | FK messages.id, nullable | self-referential |
| created_at | datetime, indexed | |

### message_status
| column | type | notes |
|---|---|---|
| id | int PK | |
| message_id | FK messages.id | |
| user_id | FK users.id | the recipient, never the sender |
| status | enum('sent','delivered','read') | |
| updated_at | datetime | |
| — unique constraint (message_id, user_id) |

### message_reactions
| column | type | notes |
|---|---|---|
| id | int PK | |
| message_id | FK messages.id | |
| user_id | FK users.id | |
| emoji | str | |
| created_at | datetime | |
| — unique constraint (message_id, user_id) — new reaction overwrites old |

---

## 2. REST API

All routes except `/auth/*` require `Authorization: Bearer <jwt>`.

### Auth
- `POST /auth/register/request-otp` `{phone_number}` → `{message}` (always succeeds, OTP is always `123456`)
- `POST /auth/register/verify` `{phone_number, otp, username, display_name, avatar_url?}` → `{access_token, user}`
- `POST /auth/login/request-otp` `{phone_number}` → `{message}`
- `POST /auth/login/verify` `{phone_number, otp}` → `{access_token, user}`
- `GET /auth/me` → current user

### Users / Contacts
- `GET /users/search?q=` → users matching username/phone (excluding self, excluding existing contacts optionally)
- `GET /contacts` → contact list with joined user info
- `POST /contacts` `{contact_user_id, nickname?}`
- `DELETE /contacts/{id}`

### Conversations
- `GET /conversations` → list, each with: last message preview, unread_count, other_user (for direct) or name/avatar (for group), sorted by `updated_at` desc
- `POST /conversations/direct` `{user_id}` → get-or-create, returns conversation
- `POST /conversations/group` `{name, member_ids: []}` → creates conversation + participants, creator = admin
- `GET /conversations/{id}` → detail incl. participants list
- `PATCH /conversations/{id}` `{name?, avatar_url?}` → admin only, group only
- `POST /conversations/{id}/members` `{user_id}` → admin only, group only
- `DELETE /conversations/{id}/members/{user_id}` → admin only, group only
- `GET /conversations/{id}/messages?before_id=&limit=50` → paginated history, each message includes its reactions and current status summary

---

## 3. WebSocket Protocol

Endpoint: `GET /ws?token=<jwt>` (upgrade). One connection per logged-in client.

Server maintains `ConnectionManager: dict[user_id, WebSocket]` in memory.
On connect: mark online, broadcast `presence` to that user's contacts/conversation peers.
On disconnect: set `last_seen = now()`, broadcast `presence` (offline).

**Client → Server**
```jsonc
{"type": "message:send", "conversation_id": 1, "content": "hi", "reply_to_id": null, "client_temp_id": "uuid"}
{"type": "typing:start", "conversation_id": 1}
{"type": "typing:stop", "conversation_id": 1}
{"type": "message:read", "conversation_id": 1, "last_message_id": 42}
{"type": "reaction:add", "message_id": 42, "emoji": "👍"}
{"type": "reaction:remove", "message_id": 42}
```

**Server → Client** (sent to relevant connected participants)
```jsonc
{"type": "message:new", "message": {...}, "client_temp_id": "uuid"}   // temp_id lets sender reconcile optimistic UI
{"type": "message:status", "message_id": 42, "user_id": 7, "status": "delivered"}
{"type": "typing", "conversation_id": 1, "user_id": 7, "is_typing": true}
{"type": "presence", "user_id": 7, "online": true, "last_seen": null}
{"type": "reaction:update", "message_id": 42, "reactions": [{"user_id":7,"emoji":"👍"}]}
{"type": "conversation:update", "conversation": {...}}   // client resorts list on this
```

Server-side handler logic:
- `message:send` → insert `messages` row, insert `message_status(sent)` for every other participant, bump `conversations.updated_at`, broadcast `message:new` + `conversation:update` to all connected participants; for any participant currently connected, immediately also flip their status row to `delivered` and broadcast `message:status`.
- `message:read` → for the given conversation, flip all unread `message_status` rows for that user up to `last_message_id` to `read`, update `conversation_participants.last_read_message_id`, broadcast `message:status` per affected message to the sender.
- `typing:*` → no DB write, just broadcast to other participants of that conversation.
- `reaction:add/remove` → upsert/delete `message_reactions` row, broadcast `reaction:update` with the full current reaction list for that message.

---

## 4. Seed Data (`app/seed.py`)

Run on backend startup if DB is empty (or via `python -m app.seed`).
- 6–8 users with realistic display names + phone numbers + avatar URLs (use a placeholder avatar service).
- Contacts: make most users mutually connected.
- 3–4 direct conversations with 10–20 messages each, timestamps spread over the last few days, mixed read/delivered statuses, at least one with an unread count > 0.
- 1–2 group conversations (3–5 members each) with messages from multiple senders, at least one reply-to and one reaction, so the UI has something to render on first load without manual testing.

---

## 5. Phase Checklist

Work top to bottom. Each phase should be runnable/testable (via curl / a WS test client) before moving on — don't stack unverified layers.

1. **Scaffold + schema** — FastAPI app boots, SQLAlchemy models created, SQLite file generated, CORS configured for the frontend origin(s).
2. **Auth** — register/login OTP-mock flow works end to end via curl, JWT returned and decodable, `/auth/me` works with the token.
3. **Contacts + user search** — search excludes self, add/remove contact works.
4. **Conversations** — direct get-or-create, group create, list endpoint returns correct sort/unread/preview, member add/remove with admin check.
5. **Messaging core over WebSocket** — two test clients (e.g. two `wscat` sessions with different tokens) can message each other in a direct conversation; status progresses sent → delivered → read correctly; history endpoint paginates.
6. **Group messaging** — same WS flow verified with 3+ connected clients in one conversation.
7. **Reactions + reply-to** — add/remove reaction broadcasts correctly; sending with `reply_to_id` returns the quoted message in the payload.
8. **Typing indicators + presence** — start/stop typing broadcasts to others only (not self); presence flips correctly on connect/disconnect.
9. **Seed script** — run it, confirm via REST that data looks realistic.
10. **Backend smoke test pass** — walk the full checklist above once more end-to-end before touching the frontend.
11. **Frontend — auth screens** — phone entry → OTP screen (prefill/hint `123456` for grader convenience) → profile setup (register) or straight to app (login).
12. **Frontend — shell + conversation list** — Signal-style left pane: avatar, name, last message preview, timestamp, unread badge, search bar filtering both contacts and conversations.
13. **Frontend — chat pane** — message bubbles (sent right/received left, matching Signal's bubble shape and palette), timestamps, tick icons for status, infinite-scroll-up pagination.
14. **Frontend — compose + typing** — input bar, send on Enter, typing indicator wired to WS, optimistic send with `client_temp_id` reconciliation.
15. **Frontend — reactions + reply-to UI** — long-press/hover to react, reply preview above input, quoted message shown inside the bubble.
16. **Frontend — groups** — create group modal, members modal with admin add/remove controls, group header showing member count.
17. **Frontend — settings placeholders + toasts** — privacy/notifications/appearance stub pages, toast on connection loss/reconnect, "Coming Soon" for calls/stories/linked devices/E2E indicator.
18. **Deploy** — backend to Railway (set `DATABASE_URL` if needed, run seed on first boot, confirm WS works over `wss://`), frontend to Vercel (set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` env vars pointing at the Railway domain), verify CORS allows the Vercel origin.
19. **README** — setup instructions, tech stack, architecture overview, DB schema (can copy from this file), API overview, assumptions (link to `decisions.md`).

---

## 6. README Requirements (final deliverable)
- Setup instructions (backend: venv, `pip install -r requirements.txt`, `uvicorn app.main:app --reload`; frontend: `npm install`, `npm run dev`).
- Tech stack used.
- Architecture overview (1-2 paragraphs + the folder tree above).
- Database schema (table list from section 1, or an ER diagram if time allows).
- API overview (table from section 2).
- Assumptions / mocked behavior (OTP is always `123456`, no real encryption, etc.) — point to `decisions.md` for full rationale.
- Live demo link + GitHub repo link.
