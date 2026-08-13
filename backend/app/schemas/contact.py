from datetime import datetime

from pydantic import BaseModel


class ContactCreate(BaseModel):
    contact_user_id: int
    nickname: str | None = None


class ContactUser(BaseModel):
    id: int
    phone_number: str
    username: str
    display_name: str
    avatar_url: str | None = None
    last_seen: datetime | None = None

    class Config:
        from_attributes = True


class ContactOut(BaseModel):
    id: int
    contact_user_id: int
    nickname: str | None = None
    created_at: datetime
    contact_user: ContactUser

    class Config:
        from_attributes = True
