from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginVerify,
    RequestOTP,
    RegisterVerify,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        phone_number=user.phone_number,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        last_seen=user.last_seen.isoformat() if user.last_seen else None,
        created_at=user.created_at.isoformat(),
    )


@router.post("/register/request-otp")
def register_request_otp(body: RequestOTP, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.phone_number == body.phone_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    return {"message": f"OTP sent to {body.phone_number}"}


@router.post("/register/verify")
def register_verify(body: RegisterVerify, db: Session = Depends(get_db)) -> AuthResponse:
    if body.otp != settings.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if db.query(User).filter(User.phone_number == body.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        phone_number=body.phone_number,
        username=body.username,
        display_name=body.display_name,
        avatar_url=body.avatar_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, user=_user_out(user))


@router.post("/login/request-otp")
def login_request_otp(body: RequestOTP, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == body.phone_number).first()
    if not user:
        raise HTTPException(status_code=400, detail="Phone number not registered")
    return {"message": f"OTP sent to {body.phone_number}"}


@router.post("/login/verify")
def login_verify(body: LoginVerify, db: Session = Depends(get_db)) -> AuthResponse:
    if body.otp != settings.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = db.query(User).filter(User.phone_number == body.phone_number).first()
    if not user:
        raise HTTPException(status_code=400, detail="Phone number not registered")

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)
