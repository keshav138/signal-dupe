from datetime import datetime

from pydantic import BaseModel


class DirectConversationCreate(BaseModel):
    user_id: int


class GroupConversationCreate(BaseModel):
    name: str
    member_ids: list[int] = []


class ConversationUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class MemberAdd(BaseModel):
    user_id: int


class UserSummary(BaseModel):
    id: int
    phone_number: str
    username: str
    display_name: str
    avatar_url: str | None = None
    last_seen: datetime | None = None

    class Config:
        from_attributes = True


class MessagePreview(BaseModel):
    id: int
    sender_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: int
    type: str
    name: str | None = None
    avatar_url: str | None = None
    updated_at: datetime
    last_message: MessagePreview | None = None
    unread_count: int = 0
    other_user: UserSummary | None = None


class ParticipantOut(BaseModel):
    user_id: int
    role: str
    joined_at: datetime
    user: UserSummary


class ConversationDetail(BaseModel):
    id: int
    type: str
    name: str | None = None
    avatar_url: str | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    participants: list[ParticipantOut]
