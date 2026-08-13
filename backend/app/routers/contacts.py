from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.contact import Contact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactOut
from app.schemas.user import UserSearchResult

router = APIRouter(tags=["contacts"])


@router.get("/users/search", response_model=list[UserSearchResult])
def search_users(
    q: str = Query(..., min_length=1),
    exclude_contacts: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User).filter(User.id != current_user.id)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.phone_number.ilike(like),
                User.display_name.ilike(like),
            )
        )

    if exclude_contacts:
        contact_ids = (
            db.query(Contact.contact_user_id)
            .filter(Contact.owner_id == current_user.id)
            .subquery()
        )
        query = query.filter(User.id.notin_(contact_ids))

    return query.limit(20).all()


@router.get("/contacts", response_model=list[ContactOut])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contacts = (
        db.query(Contact)
        .options(joinedload(Contact.contact_user))
        .filter(Contact.owner_id == current_user.id)
        .all()
    )
    return contacts


@router.post("/contacts", response_model=ContactOut)
def add_contact(
    body: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.contact_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a contact")

    target = db.get(User, body.contact_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(Contact)
        .filter(
            Contact.owner_id == current_user.id,
            Contact.contact_user_id == body.contact_user_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Contact already exists")

    contact = Contact(
        owner_id=current_user.id,
        contact_user_id=body.contact_user_id,
        nickname=body.nickname,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}")
def remove_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(contact)
    db.commit()
    return {"message": "Contact removed"}
