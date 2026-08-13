from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.conversation import (
    Conversation,
    ConversationParticipant,
    ConversationType,
    ParticipantRole,
)
from app.models.message import Message, MessageStatus, MessageStatusType
from app.models.user import User
from app.schemas.conversation import (
    ConversationDetail,
    ConversationListItem,
    ConversationUpdate,
    DirectConversationCreate,
    GroupConversationCreate,
    MemberAdd,
    MessagePreview,
    ParticipantOut,
    UserSummary,
)

router = APIRouter(tags=["conversations"])


def _user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        phone_number=user.phone_number,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        last_seen=user.last_seen,
    )


def _get_participant(db: Session, conversation_id: int, user_id: int):
    return (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        .first()
    )


def _require_admin(db: Session, conversation_id: int, user_id: int):
    participant = _get_participant(db, conversation_id, user_id)
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    if participant.role != ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return participant


@router.post("/conversations/direct", response_model=ConversationDetail)
def create_direct_conversation(
    body: DirectConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot create direct chat with yourself")

    other = db.get(User, body.user_id)
    if not other:
        raise HTTPException(status_code=404, detail="User not found")

    # Find existing direct conversation between the two users.
    my_direct_ids = (
        db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == current_user.id)
        .subquery()
    )
    existing = (
        db.query(Conversation)
        .join(ConversationParticipant)
        .filter(
            Conversation.type == ConversationType.direct,
            Conversation.id.in_(my_direct_ids),
            ConversationParticipant.user_id == body.user_id,
        )
        .first()
    )
    if existing:
        return _conversation_detail(db, existing)

    conversation = Conversation(type=ConversationType.direct, created_by=current_user.id)
    db.add(conversation)
    db.flush()

    db.add_all(
        [
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=current_user.id,
                role=ParticipantRole.admin,
            ),
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=body.user_id,
                role=ParticipantRole.member,
            ),
        ]
    )
    db.commit()
    db.refresh(conversation)
    return _conversation_detail(db, conversation)


@router.post("/conversations/group", response_model=ConversationDetail)
def create_group_conversation(
    body: GroupConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_ids = list(dict.fromkeys([current_user.id, *body.member_ids]))
    for uid in body.member_ids:
        if not db.get(User, uid):
            raise HTTPException(status_code=404, detail=f"User {uid} not found")

    conversation = Conversation(
        type=ConversationType.group,
        name=body.name,
        created_by=current_user.id,
    )
    db.add(conversation)
    db.flush()

    for uid in member_ids:
        db.add(
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=uid,
                role=ParticipantRole.admin if uid == current_user.id else ParticipantRole.member,
            )
        )
    db.commit()
    db.refresh(conversation)
    return _conversation_detail(db, conversation)


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    my_conversation_ids = (
        db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == current_user.id)
        .subquery()
    )
    conversations = (
        db.query(Conversation)
        .options(joinedload(Conversation.participants).joinedload(ConversationParticipant.user))
        .filter(Conversation.id.in_(my_conversation_ids))
        .order_by(Conversation.updated_at.desc())
        .all()
    )

    result = []
    for convo in conversations:
        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == convo.id)
            .order_by(Message.id.desc())
            .first()
        )
        unread_count = (
            db.query(func.count(MessageStatus.id))
            .join(Message, Message.id == MessageStatus.message_id)
            .filter(
                Message.conversation_id == convo.id,
                MessageStatus.user_id == current_user.id,
                MessageStatus.status != MessageStatusType.read,
            )
            .scalar()
        )

        item = ConversationListItem(
            id=convo.id,
            type=convo.type.value,
            name=convo.name,
            avatar_url=convo.avatar_url,
            updated_at=convo.updated_at,
            unread_count=unread_count,
        )
        if last_message:
            sender = db.get(User, last_message.sender_id)
            item.last_message = MessagePreview(
                id=last_message.id,
                sender_id=last_message.sender_id,
                sender_name=sender.display_name if sender else None,
                content=last_message.content,
                created_at=last_message.created_at,
            )

        if convo.type == ConversationType.direct:
            other = next(
                (p.user for p in convo.participants if p.user_id != current_user.id),
                None,
            )
            item.other_user = _user_summary(other) if other else None

        result.append(item)

    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _get_participant(db, conversation_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a participant")

    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.participants).joinedload(ConversationParticipant.user))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _conversation_detail(db, conversation)


@router.patch("/conversations/{conversation_id}", response_model=ConversationDetail)
def update_conversation(
    conversation_id: int,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Group only")
    _require_admin(db, conversation_id, current_user.id)

    if body.name is not None:
        conversation.name = body.name
    if body.avatar_url is not None:
        conversation.avatar_url = body.avatar_url
    db.commit()
    db.refresh(conversation)
    return _conversation_detail(db, conversation)


@router.post("/conversations/{conversation_id}/members", response_model=ConversationDetail)
def add_member(
    conversation_id: int,
    body: MemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Group only")
    _require_admin(db, conversation_id, current_user.id)

    if not db.get(User, body.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    if _get_participant(db, conversation_id, body.user_id):
        raise HTTPException(status_code=400, detail="Already a member")

    db.add(
        ConversationParticipant(
            conversation_id=conversation_id,
            user_id=body.user_id,
            role=ParticipantRole.member,
        )
    )
    db.commit()
    return _conversation_detail(db, conversation)


@router.delete("/conversations/{conversation_id}/members/{user_id}", response_model=ConversationDetail)
def remove_member(
    conversation_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Group only")
    _require_admin(db, conversation_id, current_user.id)

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Admin cannot remove themselves")

    participant = _get_participant(db, conversation_id, user_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Not a member")

    db.delete(participant)
    db.commit()
    return _conversation_detail(db, conversation)


def _conversation_detail(db: Session, conversation: Conversation) -> ConversationDetail:
    participants = (
        db.query(ConversationParticipant)
        .options(joinedload(ConversationParticipant.user))
        .filter(ConversationParticipant.conversation_id == conversation.id)
        .all()
    )
    return ConversationDetail(
        id=conversation.id,
        type=conversation.type.value,
        name=conversation.name,
        avatar_url=conversation.avatar_url,
        created_by=conversation.created_by,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        participants=[
            ParticipantOut(
                user_id=p.user_id,
                role=p.role.value,
                joined_at=p.joined_at,
                user=_user_summary(p.user),
            )
            for p in participants
        ],
    )
