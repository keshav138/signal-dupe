"""Seed the database with realistic demo data.

Runs automatically on backend startup when the users table is empty.
Also runnable manually as `python -m app.seed` (wipes and reseeds).
"""
import random
from datetime import timedelta

from app.db.base import Base, utcnow
from app.db.database import SessionLocal, engine
from app.models.contact import Contact
from app.models.conversation import (
    Conversation,
    ConversationParticipant,
    ConversationType,
    ParticipantRole,
)
from app.models.message import Message, MessageStatus, MessageStatusType
from app.models.reaction import MessageReaction
from app.models.user import User

USERS = [
    # (phone, username, display_name)
    ("+15550001111", "alice", "Alice Johnson"),
    ("+15550002222", "bob", "Bob Smith"),
    ("+15550003333", "carol", "Carol Martinez"),
    ("+15550004444", "dave", "Dave Chen"),
    ("+15550005555", "eve", "Eve Williams"),
    ("+15550006666", "frank", "Frank Miller"),
    ("+15550007777", "grace", "Grace Lee"),
]

# Pairs that are NOT connected (kept small for realism).
# (1, 6) = bob and grace aren't contacts of each other.
MISSING_CONTACT_PAIRS = {(1, 6)}

# (type, members (1-indexed into USERS), name, message plan)
# message plan: list of (sender_index, content, reply_index_or_None, reaction_index_or_None)
DIRECT_PLANS = {
    (0, 1): [
        (0, "Hey Bob! Did you see the new Signal features?", None),
        (1, "Yeah, the reactions are awesome 😄", None),
        (0, "Right? I've been using them everywhere", None),
        (1, "Same. Also love the reply feature", None),
        (0, "Totally agree. We should try group chat too", None),
        (1, "Let's do it. I'll invite Carol and Dave", None),
        (0, "Perfect, the more the merrier", None),
        (1, "Btw, are you free this weekend?", None),
        (0, "I think so, why?", None),
        (1, "Thinking of a hiking trip 🏔️", None),
        (0, "Count me in!", None),
        (1, "Great, I'll look up trails", None),
        (0, "Awesome, send me the details", None),
        (1, "Will do. Also that coffee place you mentioned?", None),
        (0, "Oh yes, we should go after the hike", None),
        (1, "Perfect! I'll send you the address 📍", None),
        (1, "It's right next to the trailhead", None),
    ],
    (0, 2): [
        (0, "Carol! Long time no chat", None),
        (2, "Alice! I know, it's been ages", None),
        (0, "How's the new job?", None),
        (2, "It's great! Busy but fun", None),
        (0, "Glad to hear. We should catch up soon", None),
        (2, "Definitely. Coffee next week?", None),
        (0, "Sounds good. Tuesday?", None),
        (2, "Tuesday works for me", None),
        (0, "See you then!", None),
        (2, "Looking forward to it ☕", None),
    ],
    (1, 3): [
        (1, "Dave, did you finish the design?", None),
        (3, "Almost! Just polishing the details", None),
        (1, "Nice. The client is asking for an update", None),
        (3, "I'll have it ready by tomorrow morning", None),
        (1, "You're a lifesaver", None),
        (3, "Haha, just doing my job", None),
        (1, "Beers after this project?", None),
        (3, "You read my mind", None),
    ],
    (0, 4): [
        (0, "Eve, thanks for the book recommendation!", None),
        (4, "Of course! Did you finish it?", None),
        (0, "Not yet, halfway through", None),
        (4, "The ending is amazing, keep going", None),
        (0, "Okay okay, no spoilers!", None),
        (4, "I would never 😇", None),
        (4, "Btw, book club is next Thursday", None),
        (4, "We're reading the new sci-fi novel", None),
    ],
}

GROUP_PLANS = {
    "The Crew": {
        "members": [0, 1, 2, 3],
        "messages": [
            (0, "Welcome to The Crew everyone! 🎉", None),
            (1, "Thanks for setting this up Alice", None),
            (2, "This is going to be fun", None),
            (3, "What's the plan?", None),
            (0, "Just a place for us to hang out and plan trips", None),
            (1, "Speaking of trips, hiking this weekend?", None),
            (2, "I'm in!", None),
            (3, "Me too, if it's not too early", None),
            (0, "How about 9am?", None),
            (1, "Works for me", None),
            (2, "9am it is", None),
            (0, "Great! I'll send the trail link", 5),
            (3, "Perfect, see you all there", None),
            (1, "Don't forget water 💧", None),
            (0, "And sunscreen!", None),
        ],
        "reactions": [(6, "👍", 3), (8, "❤️", 2)],
    },
    "Weekend Plans": {
        "members": [0, 4, 5, 6],
        "messages": [
            (0, "Hey everyone, welcome to Weekend Plans", None),
            (4, "Great idea for a group!", None),
            (5, "So what's first on the agenda?", None),
            (6, "I vote for brunch 🥞", None),
            (0, "Brunch sounds perfect", None),
            (5, "Sunday morning?", None),
            (4, "I'm free on Sunday", None),
            (0, "Sunday at 11, see you all there!", None),
        ],
        "reactions": [(4, "🎉", 5)],
    },
}


def _build_users(db) -> list[User]:
    users = []
    for i, (phone, username, display) in enumerate(USERS):
        user = User(
            phone_number=phone,
            username=username,
            display_name=display,
            avatar_url=f"https://i.pravatar.cc/150?img={i + 5}",
        )
        db.add(user)
        users.append(user)
    db.flush()
    return users


def _build_contacts(db, users: list[User]) -> None:
    n = len(users)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if (i, j) in MISSING_CONTACT_PAIRS or (j, i) in MISSING_CONTACT_PAIRS:
                continue
            db.add(Contact(owner_id=users[i].id, contact_user_id=users[j].id))
    db.flush()


def _timestamps(count: int, days_back: int) -> list:
    """Spread `count` timestamps over the last `days_back` days, oldest first."""
    now = utcnow()
    offsets = sorted(random.uniform(0, days_back * 24 * 3600) for _ in range(count))
    return [now - timedelta(seconds=days_back * 24 * 3600 - off) for off in offsets]


def _build_direct(db, users, pair, messages_spec, unread_plan: dict) -> Conversation:
    a, b = pair
    convo = Conversation(type=ConversationType.direct, created_by=users[a].id)
    db.add(convo)
    db.flush()

    db.add(
        ConversationParticipant(
            conversation_id=convo.id, user_id=users[a].id, role=ParticipantRole.admin
        )
    )
    db.add(
        ConversationParticipant(
            conversation_id=convo.id, user_id=users[b].id, role=ParticipantRole.member
        )
    )
    db.flush()

    _insert_messages(db, convo, users, [a, b], messages_spec, unread_plan)
    return convo


def _insert_messages(
    db, convo: Conversation, users, member_indexes, messages_spec, unread_plan: dict
) -> None:
    """Insert messages with statuses.

    unread_plan: dict {recipient_index: number_of_trailing_messages_unread}
    """
    timestamps = _timestamps(len(messages_spec), days_back=3)
    convo_reply_map.setdefault(convo.id, [])

    for idx, (sender_idx, content, reply_idx) in enumerate(messages_spec):
        sender = users[sender_idx]
        reply_to_id = None
        if reply_idx is not None:
            reply_to_id = convo_reply_map[convo.id][reply_idx]
        msg = Message(
            conversation_id=convo.id,
            sender_id=sender.id,
            content=content,
            reply_to_id=reply_to_id,
            created_at=timestamps[idx],
        )
        db.add(msg)
        db.flush()
        convo_reply_map[convo.id].append(msg.id)

        for member_idx in member_indexes:
            if member_idx == sender_idx:
                continue
            unread = unread_plan.get(member_idx, 0)
            is_unread = idx >= len(messages_spec) - unread
            status = MessageStatusType.read if not is_unread else MessageStatusType.delivered
            db.add(
                MessageStatus(
                    message_id=msg.id,
                    user_id=users[member_idx].id,
                    status=status,
                    updated_at=timestamps[idx],
                )
            )

    # last_read_message_id per participant
    for member_idx in member_indexes:
        unread = unread_plan.get(member_idx, 0)
        last_read = len(messages_spec) - unread - 1
        participant = (
            db.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversation_id == convo.id,
                ConversationParticipant.user_id == users[member_idx].id,
            )
            .first()
        )
        if last_read >= 0:
            participant.last_read_message_id = convo_reply_map[convo.id][last_read]

    convo.updated_at = timestamps[-1]
    convo.created_at = timestamps[0]
    db.flush()


def _build_group(db, users, name: str, plan: dict) -> Conversation:
    members = plan["members"]
    convo = Conversation(
        type=ConversationType.group,
        name=name,
        created_by=users[members[0]].id,
    )
    db.add(convo)
    db.flush()

    for idx in members:
        db.add(
            ConversationParticipant(
                conversation_id=convo.id,
                user_id=users[idx].id,
                role=ParticipantRole.admin if idx == members[0] else ParticipantRole.member,
            )
        )
    db.flush()

    _insert_messages(db, convo, users, members, plan["messages"], unread_plan={})

    for msg_idx, emoji, user_idx in plan["reactions"]:
        msg_id = convo_reply_map[convo.id][msg_idx]
        db.add(
            MessageReaction(
                message_id=msg_id, user_id=users[user_idx].id, emoji=emoji
            )
        )
    db.flush()
    return convo


# Maps convo.id -> ordered message ids for reply_to resolution.
convo_reply_map: dict[int, list[int]] = {}


def run_seed(db) -> None:
    convo_reply_map.clear()
    random.seed(42)

    users = _build_users(db)
    _build_contacts(db, users)

    # Direct conversations.
    # alice-bob: alice has 2 unread trailing messages from bob.
    _build_direct(db, users, (0, 1), DIRECT_PLANS[(0, 1)], unread_plan={0: 2})
    _build_direct(db, users, (0, 2), DIRECT_PLANS[(0, 2)], unread_plan={})
    _build_direct(db, users, (1, 3), DIRECT_PLANS[(1, 3)], unread_plan={})
    # alice-eve: alice has 1 unread from eve.
    _build_direct(db, users, (0, 4), DIRECT_PLANS[(0, 4)], unread_plan={0: 1})

    # Group conversations.
    _build_group(db, users, "The Crew", GROUP_PLANS["The Crew"])
    _build_group(db, users, "Weekend Plans", GROUP_PLANS["Weekend Plans"])

    db.commit()
    print(
        f"Seeded {len(USERS)} users, {len(DIRECT_PLANS)} direct and "
        f"{len(GROUP_PLANS)} group conversations."
    )


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            print("Empty database detected, seeding demo data...")
            run_seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    # Manual run: wipe and reseed.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()
