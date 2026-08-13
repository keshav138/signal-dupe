from sqlalchemy.orm import Session, joinedload

from app.db.base import utcnow
from app.models.conversation import (
    Conversation,
    ConversationParticipant,
    ConversationType,
)
from app.models.message import Message, MessageStatus, MessageStatusType
from app.models.reaction import MessageReaction
from app.models.user import User
from app.ws.connection_manager import ConnectionManager
from app.ws.serializers import serialize_conversation_list_item, serialize_message


def _participant_ids(db: Session, conversation_id: int) -> list[int]:
    return [
        r[0]
        for r in db.query(ConversationParticipant.user_id)
        .filter(ConversationParticipant.conversation_id == conversation_id)
        .all()
    ]


async def handle_message_send(
    db: Session,
    manager: ConnectionManager,
    user: User,
    conversation_id: int,
    content: str,
    reply_to_id: int | None,
    client_temp_id: str | None,
) -> dict:
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user.id,
        )
        .first()
    )
    if not participant:
        raise ValueError("Not a participant of this conversation")

    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        content=content,
        reply_to_id=reply_to_id,
    )
    db.add(message)
    db.flush()

    recipient_ids = [
        uid for uid in _participant_ids(db, conversation_id) if uid != user.id
    ]
    for uid in recipient_ids:
        db.add(
            MessageStatus(
                message_id=message.id,
                user_id=uid,
                status=MessageStatusType.sent,
            )
        )

    conversation = db.get(Conversation, conversation_id)
    conversation.updated_at = utcnow()

    db.commit()
    db.refresh(message)

    serialized = serialize_message(db, message, viewer_id=user.id)

    await manager.broadcast_to_users(
        recipient_ids + [user.id],
        {
            "type": "message:new",
            "message": serialized,
            "client_temp_id": client_temp_id,
        },
    )

    # Flip status of connected recipients to delivered immediately.
    connected_recipients = [uid for uid in recipient_ids if manager.is_online(uid)]
    for uid in connected_recipients:
        row = (
            db.query(MessageStatus)
            .filter(
                MessageStatus.message_id == message.id,
                MessageStatus.user_id == uid,
            )
            .first()
        )
        if row is not None:
            row.status = MessageStatusType.delivered
            await manager.send_to_user(
                user.id,
                {
                    "type": "message:status",
                    "message_id": message.id,
                    "user_id": uid,
                    "status": "delivered",
                },
            )
    db.commit()

    await _broadcast_conversation_update(db, manager, conversation_id)
    return serialized


async def handle_message_read(
    db: Session,
    manager: ConnectionManager,
    user: User,
    conversation_id: int,
    last_message_id: int,
) -> None:
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user.id,
        )
        .first()
    )
    if not participant:
        raise ValueError("Not a participant of this conversation")

    # All messages in the conversation up to last_message_id that were sent by others.
    affected = (
        db.query(MessageStatus)
        .join(Message, Message.id == MessageStatus.message_id)
        .filter(
            Message.conversation_id == conversation_id,
            MessageStatus.user_id == user.id,
            Message.id <= last_message_id,
            MessageStatus.status != MessageStatusType.read,
        )
        .all()
    )

    for row in affected:
        row.status = MessageStatusType.read

    participant.last_read_message_id = last_message_id
    db.commit()

    for row in affected:
        msg = db.get(Message, row.message_id)
        if msg is not None:
            await manager.send_to_user(
                msg.sender_id,
                {
                    "type": "message:status",
                    "message_id": msg.id,
                    "user_id": user.id,
                    "status": "read",
                },
            )


async def handle_reaction_add(
    db: Session,
    manager: ConnectionManager,
    user: User,
    message_id: int,
    emoji: str,
) -> None:
    message = db.get(Message, message_id)
    if message is None:
        raise ValueError("Message not found")

    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == message.conversation_id,
            ConversationParticipant.user_id == user.id,
        )
        .first()
    )
    if not participant:
        raise ValueError("Not a participant of this conversation")

    existing = (
        db.query(MessageReaction)
        .filter(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user.id,
        )
        .first()
    )
    if existing:
        existing.emoji = emoji
    else:
        db.add(MessageReaction(message_id=message_id, user_id=user.id, emoji=emoji))
    db.commit()

    await _broadcast_reactions(db, manager, message.conversation_id, message_id)


async def handle_reaction_remove(
    db: Session,
    manager: ConnectionManager,
    user: User,
    message_id: int,
) -> None:
    message = db.get(Message, message_id)
    if message is None:
        raise ValueError("Message not found")

    row = (
        db.query(MessageReaction)
        .filter(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user.id,
        )
        .first()
    )
    if row:
        db.delete(row)
        db.commit()

    await _broadcast_reactions(db, manager, message.conversation_id, message_id)


async def handle_typing(
    db: Session,
    manager: ConnectionManager,
    user: User,
    conversation_id: int,
    is_typing: bool,
) -> None:
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user.id,
        )
        .first()
    )
    if not participant:
        return
    others = [uid for uid in _participant_ids(db, conversation_id) if uid != user.id]
    await manager.broadcast_to_users(
        others,
        {"type": "typing", "conversation_id": conversation_id, "user_id": user.id, "is_typing": is_typing},
    )


async def _broadcast_reactions(
    db: Session,
    manager: ConnectionManager,
    conversation_id: int,
    message_id: int,
) -> None:
    reactions = [
        {"user_id": r.user_id, "emoji": r.emoji}
        for r in db.query(MessageReaction)
        .filter(MessageReaction.message_id == message_id)
        .all()
    ]
    await manager.broadcast_to_users(
        _participant_ids(db, conversation_id),
        {"type": "reaction:update", "message_id": message_id, "reactions": reactions},
    )


async def _broadcast_conversation_update(
    db: Session, manager: ConnectionManager, conversation_id: int
) -> None:
    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.participants).joinedload(ConversationParticipant.user))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if conversation is None:
        return
    for uid in _participant_ids(db, conversation_id):
        item = serialize_conversation_list_item(db, conversation, uid)
        await manager.send_to_user(
            uid, {"type": "conversation:update", "conversation": item}
        )


def get_conversation_type(db: Session, conversation_id: int) -> ConversationType | None:
    convo = db.get(Conversation, conversation_id)
    return convo.type if convo else None
