from __future__ import annotations

from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from .case_store import CaseStore
from .config import ALLOWED_ORIGINS, APP_TITLE, CHECKPOINT_DB_PATH, DATA_DIR
from .mock_data import list_mock_documents, resolve_submission
from .models import UploadRequest, ValidationRequest
from .workflow import WorkflowService


@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with AsyncSqliteSaver.from_conn_string(str(CHECKPOINT_DB_PATH)) as saver:
        store = CaseStore()
        workflow = WorkflowService(store, saver)
        app.state.store = store
        app.state.workflow = workflow
        yield


app = FastAPI(title=APP_TITLE, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/mock-documents")
async def mock_documents() -> dict[str, list[dict[str, object]]]:
    return {"items": list_mock_documents()}


@app.post("/api/upload")
async def upload_case(payload: UploadRequest) -> dict[str, object]:
    title, content, template_id = resolve_submission(payload.title, payload.content, payload.template_id)
    if not content.strip():
        raise HTTPException(status_code=400, detail="Document content is empty.")
    case_id = uuid4().hex
    store: CaseStore = app.state.store
    workflow: WorkflowService = app.state.workflow
    await store.create_case(case_id, title, content, template_id=template_id)
    await workflow.start_case(case_id)
    return {"case": await store.case_payload(case_id)}


@app.get("/api/cases/{case_id}")
async def get_case(case_id: str) -> dict[str, object]:
    store: CaseStore = app.state.store
    try:
        return {"case": await store.case_payload(case_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc


@app.post("/api/cases/{case_id}/validate")
async def validate_case(case_id: str, payload: ValidationRequest) -> dict[str, object]:
    store: CaseStore = app.state.store
    workflow: WorkflowService = app.state.workflow
    try:
        await store.require_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found.") from exc
    try:
        await workflow.resume_case(case_id, payload.approved)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"case": await store.case_payload(case_id)}


@app.websocket("/ws/stream/{case_id}")
async def stream_case(websocket: WebSocket, case_id: str) -> None:
    store: CaseStore = app.state.store
    try:
        await store.require_case(case_id)
    except KeyError:
        await websocket.accept()
        await websocket.send_json(
            {
                "kind": "workflow_error",
                "payload": {"message": "Unknown case id."},
            }
        )
        await websocket.close()
        return

    snapshot, events = await store.attach(case_id, websocket)
    try:
        await websocket.send_json(
            {
                "id": f"{case_id}-snapshot",
                "case_id": case_id,
                "kind": "case_state",
                "timestamp": snapshot.get("submitted_at"),
                "payload": {"snapshot": snapshot},
            }
        )
        for event in events:
            await websocket.send_json(event)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await store.detach(case_id, websocket)
