import jwt
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.base import utcnow
from app.db.database import SessionLocal, get_db
from app.models.conversation import ConversationParticipant
from app.models.user import User
from app.ws import handlers
from app.ws.connection_manager import manager

router = APIRouter()


def _get_user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return db.get(User, int(user_id))


def _peer_ids(db: Session, user_id: int) -> list[int]:
    """Users sharing a conversation with `user_id` (for presence broadcasts)."""
    my_convo_ids = (
        db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == user_id)
        .subquery()
    )
    peers = (
        db.query(ConversationParticipant.user_id)
        .filter(
            ConversationParticipant.conversation_id.in_(my_convo_ids),
            ConversationParticipant.user_id != user_id,
        )
        .distinct()
        .all()
    )
    return [p[0] for p in peers]


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = _get_user_from_token(token, db)
        if user is None:
            await ws.close(code=4401)
            return

        await ws.accept()
        await manager.connect(user.id, ws)

        peers = _peer_ids(db, user.id)
        await manager.broadcast_to_users(
            peers,
            {
                "type": "presence",
                "user_id": user.id,
                "online": True,
                "last_seen": None,
            },
        )

        # Tell the connecting user which peers are already online.
        for peer_id in peers:
            if manager.is_online(peer_id):
                peer_user = db.get(User, peer_id)
                await manager.send_to_user(
                    user.id,
                    {
                        "type": "presence",
                        "user_id": peer_id,
                        "online": True,
                        "last_seen": None,
                    },
                )

        try:
            while True:
                raw = await ws.receive_json()
                msg_type = raw.get("type")

                try:
                    if msg_type == "message:send":
                        await handlers.handle_message_send(
                            db,
                            manager,
                            user,
                            conversation_id=raw["conversation_id"],
                            content=raw.get("content", ""),
                            reply_to_id=raw.get("reply_to_id"),
                            client_temp_id=raw.get("client_temp_id"),
                        )
                    elif msg_type == "message:read":
                        await handlers.handle_message_read(
                            db,
                            manager,
                            user,
                            conversation_id=raw["conversation_id"],
                            last_message_id=raw["last_message_id"],
                        )
                    elif msg_type == "typing:start":
                        await handlers.handle_typing(
                            db, manager, user, raw["conversation_id"], True
                        )
                    elif msg_type == "typing:stop":
                        await handlers.handle_typing(
                            db, manager, user, raw["conversation_id"], False
                        )
                    elif msg_type == "reaction:add":
                        await handlers.handle_reaction_add(
                            db, manager, user, raw["message_id"], raw.get("emoji", "")
                        )
                    elif msg_type == "reaction:remove":
                        await handlers.handle_reaction_remove(
                            db, manager, user, raw["message_id"]
                        )
                except KeyError as exc:
                    await ws.send_json({"type": "error", "detail": f"Missing field: {exc}"})
                except ValueError as exc:
                    await ws.send_json({"type": "error", "detail": str(exc)})
        except WebSocketDisconnect:
            pass
        finally:
            # Only broadcast offline if THIS socket is still the active one.
            # A replaced socket must not announce the user as offline.
            if manager.is_active(user.id, ws):
                manager.disconnect(user.id, ws)
                user.last_seen = utcnow()
                db.commit()
                await manager.broadcast_to_users(
                    peers,
                    {
                        "type": "presence",
                        "user_id": user.id,
                        "online": False,
                        "last_seen": user.last_seen.isoformat(),
                    },
                )
    finally:
        db.close()
