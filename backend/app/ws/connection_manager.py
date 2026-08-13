import asyncio
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """In-memory registry of active WebSocket connections, keyed by user id."""

    def __init__(self) -> None:
        self.active: dict[int, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            old = self.active.get(user_id)
            if old is not None:
                try:
                    await old.close(code=4000, reason="replaced by new connection")
                except Exception:
                    pass
            self.active[user_id] = ws

    def disconnect(self, user_id: int, ws: WebSocket | None = None) -> None:
        if ws is None:
            self.active.pop(user_id, None)
        elif self.active.get(user_id) is ws:
            self.active.pop(user_id, None)

    def is_active(self, user_id: int, ws: WebSocket) -> bool:
        return self.active.get(user_id) is ws

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active

    async def send_to_user(self, user_id: int, payload: dict[str, Any]) -> None:
        ws = self.active.get(user_id)
        if ws is None:
            return
        try:
            await ws.send_json(payload)
        except Exception:
            self.active.pop(user_id, None)

    async def broadcast_to_users(self, user_ids, payload: dict[str, Any]) -> None:
        for uid in set(user_ids):
            await self.send_to_user(uid, payload)


manager = ConnectionManager()
