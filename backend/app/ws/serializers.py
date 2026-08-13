from sqlalchemy import func

from app.models.conversation import Conversation, ConversationType
from app.models.message import Message, MessageStatus, MessageStatusType
from app.models.reaction import MessageReaction
from app.models.user import User

_STATUS_ORDER = {"sent": 0, "delivered": 1, "read": 2}


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "phone_number": user.phone_number,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }


def _sender_status(db, message: Message) -> str:
    """Worst-case aggregate across all recipient rows (drives the tick icons)."""
    rows = (
        db.query(MessageStatus).filter(MessageStatus.message_id == message.id).all()
    )
    if not rows:
        return "sent"
    return min((r.status.value for r in rows), key=lambda s: _STATUS_ORDER[s])


def serialize_message(db, message: Message, viewer_id: int) -> dict:
    sender = db.get(User, message.sender_id)

    reply_to = None
    if message.reply_to_id is not None:
        reply_msg = db.get(Message, message.reply_to_id)
        if reply_msg is not None:
            reply_sender = db.get(User, reply_msg.sender_id)
            reply_to = {
                "id": reply_msg.id,
                "sender_id": reply_msg.sender_id,
                "content": reply_msg.content,
                "created_at": reply_msg.created_at.isoformat(),
                "sender": _user_dict(reply_sender) if reply_sender else None,
            }

    reactions = [
        {"user_id": r.user_id, "emoji": r.emoji}
        for r in db.query(MessageReaction)
        .filter(MessageReaction.message_id == message.id)
        .all()
    ]

    if viewer_id == message.sender_id:
        status = _sender_status(db, message)
    else:
        row = (
            db.query(MessageStatus)
            .filter(
                MessageStatus.message_id == message.id,
                MessageStatus.user_id == viewer_id,
            )
            .first()
        )
        status = row.status.value if row else "sent"

    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "content": message.content,
        "reply_to_id": message.reply_to_id,
        "created_at": message.created_at.isoformat(),
        "sender": _user_dict(sender) if sender else None,
        "reply_to": reply_to,
        "reactions": reactions,
        "status": status,
    }


def serialize_conversation_list_item(db, conversation: Conversation, user_id: int) -> dict:
    last_message = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.id.desc())
        .first()
    )
    unread_count = (
        db.query(func.count(MessageStatus.id))
        .join(Message, Message.id == MessageStatus.message_id)
        .filter(
            Message.conversation_id == conversation.id,
            MessageStatus.user_id == user_id,
            MessageStatus.status != MessageStatusType.read,
        )
        .scalar()
    )

    item = {
        "id": conversation.id,
        "type": conversation.type.value,
        "name": conversation.name,
        "avatar_url": conversation.avatar_url,
        "updated_at": conversation.updated_at.isoformat(),
        "unread_count": unread_count,
        "last_message": None,
        "other_user": None,
    }
    if last_message:
        sender = db.get(User, last_message.sender_id)
        item["last_message"] = {
            "id": last_message.id,
            "sender_id": last_message.sender_id,
            "sender_name": sender.display_name if sender else None,
            "content": last_message.content,
            "created_at": last_message.created_at.isoformat(),
        }
    if conversation.type == ConversationType.direct:
        other = None
        for p in conversation.participants:
            if p.user_id != user_id:
                other = p.user
                break
        if other is not None:
            item["other_user"] = _user_dict(other)
    return item
