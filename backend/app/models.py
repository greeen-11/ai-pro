from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator
from typing_extensions import Literal, TypedDict

AgentId = Literal["research", "risk", "decision"]
AgentStatus = Literal[
    "idle",
    "thinking",
    "outputting",
    "awaiting_human",
    "completed",
    "blocked",
]
CaseStatus = Literal[
    "queued",
    "running",
    "awaiting_review",
    "approved",
    "rejected",
    "completed",
    "error",
]


class SourceItem(BaseModel):
    title: str
    detail: str
    url: str


class RiskFlag(BaseModel):
    title: str
    severity: Literal["low", "medium", "high"]
    detail: str
    keyword: str


class AgentCard(BaseModel):
    id: AgentId
    name: str
    status: AgentStatus
    summary: str
    detail: str
    updated_at: str


class CaseSnapshot(BaseModel):
    case_id: str
    title: str
    document_text: str
    submitted_at: str
    current_phase: str
    risk_level: Literal["low", "medium", "high", "pending"]
    decision: str
    final_status: CaseStatus
    research_summary: str
    risk_summary: str
    decision_summary: str
    sources: list[SourceItem]
    risk_flags: list[RiskFlag]
    messages: list[dict[str, Any]]
    agent_cards: dict[str, AgentCard]


class MockDocument(BaseModel):
    id: str
    title: str
    category: str
    summary: str
    content: str
    metadata: dict[str, str]


class UploadRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    template_id: str | None = None

    @model_validator(mode="after")
    def ensure_input_present(self) -> "UploadRequest":
        if not (self.content and self.content.strip()) and not self.template_id:
            raise ValueError("Provide either document content or a template_id.")
        return self


class ValidationRequest(BaseModel):
    approved: bool = Field(..., description="Human review outcome.")


class CaseResponse(BaseModel):
    id: str
    title: str
    content: str
    created_at: str
    updated_at: str
    status: CaseStatus
    snapshot: CaseSnapshot
    events: list[dict[str, Any]]


class EventEnvelope(BaseModel):
    id: str
    case_id: str
    kind: str
    timestamp: str
    payload: dict[str, Any]


class WorkflowState(TypedDict):
    case_id: str
    title: str
    document_text: str
    submitted_at: str
    current_phase: str
    risk_level: str
    decision: str
    final_status: str
    research_summary: str
    risk_summary: str
    decision_summary: str
    sources: list[dict[str, Any]]
    risk_flags: list[dict[str, Any]]
    messages: list[dict[str, Any]]
    agent_cards: dict[str, dict[str, Any]]


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()


def build_initial_agents() -> dict[str, dict[str, Any]]:
    now = utc_timestamp()
    return {
        "research": {
            "id": "research",
            "name": "Research Agent",
            "status": "idle",
            "summary": "Waiting for intake",
            "detail": "No contextual signals processed yet.",
            "updated_at": now,
        },
        "risk": {
            "id": "risk",
            "name": "Risk Agent",
            "status": "idle",
            "summary": "Waiting for research",
            "detail": "Risk register will populate after background checks.",
            "updated_at": now,
        },
        "decision": {
            "id": "decision",
            "name": "Decision Agent",
            "status": "idle",
            "summary": "Waiting for dossier",
            "detail": "Recommendation package not started.",
            "updated_at": now,
        },
    }


def build_initial_snapshot(case_id: str, title: str, document_text: str) -> dict[str, Any]:
    return {
        "case_id": case_id,
        "title": title,
        "document_text": document_text,
        "submitted_at": utc_timestamp(),
        "current_phase": "queued",
        "risk_level": "pending",
        "decision": "",
        "final_status": "queued",
        "research_summary": "",
        "risk_summary": "",
        "decision_summary": "",
        "sources": [],
        "risk_flags": [],
        "messages": [],
        "agent_cards": build_initial_agents(),
    }
