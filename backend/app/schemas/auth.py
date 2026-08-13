from pydantic import BaseModel, Field


class RequestOTP(BaseModel):
    phone_number: str = Field(min_length=1)


class RegisterVerify(BaseModel):
    phone_number: str
    otp: str
    username: str
    display_name: str
    avatar_url: str | None = None


class LoginVerify(BaseModel):
    phone_number: str
    otp: str


class UserOut(BaseModel):
    id: int
    phone_number: str
    username: str
    display_name: str
    avatar_url: str | None = None
    last_seen: str | None = None
    created_at: str

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    user: UserOut
