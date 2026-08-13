from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.conversation import ConversationParticipant
from app.models.message import Message
from app.models.user import User
from app.ws.serializers import serialize_message

router = APIRouter(tags=["messages"])


@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    before_id: int | None = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")

    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if before_id is not None:
        query = query.filter(Message.id < before_id)
    messages = query.order_by(Message.id.desc()).limit(limit).all()

    serialized = [serialize_message(db, m, viewer_id=current_user.id) for m in messages]
    serialized.reverse()
    return serialized
