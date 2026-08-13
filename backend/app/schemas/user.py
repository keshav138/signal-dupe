from pydantic import BaseModel


class UserSearchResult(BaseModel):
    id: int
    phone_number: str
    username: str
    display_name: str
    avatar_url: str | None = None

    class Config:
        from_attributes = True
