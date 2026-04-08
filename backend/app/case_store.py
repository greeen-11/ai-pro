from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

from .models import build_initial_snapshot, utc_timestamp


@dataclass
class CaseRecord:
    id: str
    title: str
    content: str
    created_at: str
    updated_at: str
    status: str
    template_id: str | None = None
    snapshot: dict[str, Any] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)
    run_task: asyncio.Task[Any] | None = None


class CaseStore:
    def __init__(self) -> None:
        self._cases: dict[str, CaseRecord] = {}
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def create_case(
        self,
        case_id: str,
        title: str,
        content: str,
        template_id: str | None = None,
    ) -> CaseRecord:
        created_at = utc_timestamp()
        record = CaseRecord(
            id=case_id,
            title=title,
            content=content,
            created_at=created_at,
            updated_at=created_at,
            status="queued",
            template_id=template_id,
            snapshot=build_initial_snapshot(case_id, title, content),
        )
        async with self._lock:
            self._cases[case_id] = record
        return record

    async def get_case(self, case_id: str) -> CaseRecord | None:
        async with self._lock:
            return self._cases.get(case_id)

    async def require_case(self, case_id: str) -> CaseRecord:
        case = await self.get_case(case_id)
        if case is None:
            raise KeyError(case_id)
        return case

    async def set_status(self, case_id: str, status: str) -> None:
        async with self._lock:
            case = self._cases[case_id]
            case.status = status
            case.updated_at = utc_timestamp()
            if case.snapshot:
                case.snapshot["final_status"] = status

    async def set_snapshot(self, case_id: str, snapshot: dict[str, Any]) -> None:
        async with self._lock:
            case = self._cases[case_id]
            case.snapshot = jsonable_encoder(snapshot)
            case.updated_at = utc_timestamp()
            case.status = case.snapshot.get("final_status", case.status)

    async def append_event(self, case_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            case = self._cases[case_id]
            case.events.append(jsonable_encoder(event))
            case.events = case.events[-400:]
            case.updated_at = utc_timestamp()

    async def set_run_task(self, case_id: str, task: asyncio.Task[Any] | None) -> None:
        async with self._lock:
            case = self._cases[case_id]
            case.run_task = task

    async def get_run_task(self, case_id: str) -> asyncio.Task[Any] | None:
        async with self._lock:
            case = self._cases[case_id]
            return case.run_task

    async def attach(self, case_id: str, websocket: WebSocket) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        await websocket.accept()
        async with self._lock:
            self._connections[case_id].add(websocket)
            case = self._cases.get(case_id)
            snapshot = jsonable_encoder(case.snapshot if case else {})
            events = jsonable_encoder(case.events if case else [])
        return snapshot, events

    async def detach(self, case_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(case_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(case_id, None)

    async def broadcast(self, case_id: str, message: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(case_id, set()))
        if not sockets:
            return
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(jsonable_encoder(message))
            except Exception:
                stale.append(socket)
        for socket in stale:
            await self.detach(case_id, socket)

    async def case_payload(self, case_id: str) -> dict[str, Any]:
        case = await self.require_case(case_id)
        return {
            "id": case.id,
            "title": case.title,
            "content": case.content,
            "created_at": case.created_at,
            "updated_at": case.updated_at,
            "status": case.status,
            "snapshot": jsonable_encoder(case.snapshot),
            "events": jsonable_encoder(case.events),
        }
