from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

from fastapi.encoders import jsonable_encoder
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from .case_store import CaseStore
from .config import STREAM_DELAY_SECONDS
from .mock_data import (
    build_decision_summary,
    build_research_summary,
    build_risk_flags,
    build_risk_summary,
    build_sources,
    summarize_risk_level,
)
from .models import WorkflowState, build_initial_agents, utc_timestamp


def _clone_agents(state: WorkflowState) -> dict[str, dict[str, Any]]:
    existing = state.get("agent_cards") or build_initial_agents()
    return {key: dict(value) for key, value in existing.items()}


def _set_agent(
    agents: dict[str, dict[str, Any]],
    agent_id: str,
    *,
    status: str,
    summary: str,
    detail: str,
) -> None:
    agents[agent_id] = {
        **agents.get(agent_id, {}),
        "id": agent_id,
        "name": agents.get(agent_id, {}).get("name", f"{agent_id.title()} Agent"),
        "status": status,
        "summary": summary,
        "detail": detail,
        "updated_at": utc_timestamp(),
    }


def _append_message(
    state: WorkflowState,
    agent: str,
    stage: str,
    content: str,
) -> list[dict[str, Any]]:
    messages = [*state.get("messages", [])]
    messages.append(
        {
            "agent": agent,
            "stage": stage,
            "content": content,
            "timestamp": utc_timestamp(),
        }
    )
    return messages


async def _emit(writer: Any, payload: dict[str, Any], delay: float = STREAM_DELAY_SECONDS) -> None:
    writer(payload)
    await asyncio.sleep(delay)


async def research_node(state: WorkflowState) -> dict[str, Any]:
    writer = get_stream_writer()
    await _emit(
        writer,
        {
            "kind": "agent_status",
            "agent": "research",
            "status": "thinking",
            "headline": "Context sweep started",
            "detail": "Indexing supplier background, obligation clusters, and comparable commercial posture.",
        },
    )
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "research",
            "style": "thought",
            "message": "Normalizing the submitted document into procurement clauses, commercial variables, and delivery dependencies.",
        },
    )
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "research",
            "style": "tool",
            "message": "Mock tool: supplier-watchlist.lookup -> retrieved delivery resilience and benchmark sourcing posture.",
        },
    )
    sources = build_sources(state["title"], state["document_text"])
    summary = build_research_summary(state["title"], state["document_text"], sources)
    await _emit(
        writer,
        {
            "kind": "agent_status",
            "agent": "research",
            "status": "outputting",
            "headline": "Publishing research packet",
            "detail": summary,
        },
    )
    agents = _clone_agents(state)
    _set_agent(
        agents,
        "research",
        status="completed",
        summary="Research completed",
        detail=summary,
    )
    return {
        "current_phase": "risk_analysis",
        "final_status": "running",
        "research_summary": summary,
        "sources": sources,
        "messages": _append_message(state, "research", "summary", summary),
        "agent_cards": agents,
    }


async def risk_node(state: WorkflowState) -> dict[str, Any]:
    writer = get_stream_writer()
    await _emit(
        writer,
        {
            "kind": "agent_status",
            "agent": "risk",
            "status": "thinking",
            "headline": "Risk scoring in progress",
            "detail": "Cross-checking redline exposure, concentration risk, and control gaps in the submission.",
        },
    )
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "risk",
            "style": "thought",
            "message": "Stack-ranking clauses by financial downside, switching cost, and compliance exposure.",
        },
    )
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "risk",
            "style": "tool",
            "message": "Mock tool: playbook.diff -> compared the intake against preferred indemnity, termination, and control language.",
        },
    )
    risk_flags = build_risk_flags(state["document_text"])
    risk_level = summarize_risk_level(risk_flags)
    summary = build_risk_summary(risk_flags, risk_level)
    await _emit(
        writer,
        {
            "kind": "agent_status",
            "agent": "risk",
            "status": "outputting",
            "headline": f"Risk level set to {risk_level.upper()}",
            "detail": summary,
        },
    )
    agents = _clone_agents(state)
    _set_agent(
        agents,
        "risk",
        status="completed",
        summary=f"Risk level: {risk_level.upper()}",
        detail=summary,
    )
    return {
        "current_phase": "decisioning",
        "risk_level": risk_level,
        "risk_summary": summary,
        "risk_flags": risk_flags,
        "messages": _append_message(state, "risk", "summary", summary),
        "agent_cards": agents,
    }


async def decision_node(state: WorkflowState) -> dict[str, Any]:
    writer = get_stream_writer()
    await _emit(
        writer,
        {
            "kind": "agent_status",
            "agent": "decision",
            "status": "thinking",
            "headline": "Recommendation package assembling",
            "detail": "Blending research context with quantified risk posture to shape the procurement recommendation.",
        },
    )
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "decision",
            "style": "thought",
            "message": "Selecting the negotiation posture, escalation path, and approval gating that best fit this deal profile.",
        },
    )
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "decision",
            "style": "tool",
            "message": "Mock tool: decision-matrix.score -> mapped risk, value, and operational dependency to a final action path.",
        },
    )
    summary = build_decision_summary(state["title"], state["risk_level"], state["risk_flags"])
    await _emit(
        writer,
        {
            "kind": "agent_status",
            "agent": "decision",
            "status": "awaiting_human",
            "headline": "Human validation required",
            "detail": summary,
        },
    )
    await _emit(
        writer,
        {
            "kind": "review_required",
            "agent": "decision",
            "proposal": summary,
            "risk_level": state["risk_level"],
            "risk_summary": state["risk_summary"],
            "message": "Decision package is ready for human review.",
        },
    )
    agents = _clone_agents(state)
    _set_agent(
        agents,
        "decision",
        status="awaiting_human",
        summary="Awaiting reviewer",
        detail=summary,
    )
    return {
        "current_phase": "human_review",
        "decision": summary,
        "decision_summary": summary,
        "final_status": "awaiting_review",
        "messages": _append_message(state, "decision", "proposal", summary),
        "agent_cards": agents,
    }


def human_review_node(state: WorkflowState) -> Command[str]:
    approved = interrupt(
        {
            "message": "Approve or reject the proposed procurement recommendation.",
            "proposal": state["decision_summary"],
            "risk_level": state["risk_level"],
            "risk_summary": state["risk_summary"],
        }
    )
    return Command(goto="finalize_approved" if approved else "finalize_rejected")


async def finalize_approved_node(state: WorkflowState) -> dict[str, Any]:
    writer = get_stream_writer()
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "decision",
            "style": "output",
            "message": "Human reviewer approved the recommendation package. Closing the case as approved.",
        },
        delay=STREAM_DELAY_SECONDS / 1.5,
    )
    agents = _clone_agents(state)
    _set_agent(
        agents,
        "decision",
        status="completed",
        summary="Recommendation approved",
        detail=state["decision_summary"],
    )
    return {
        "current_phase": "completed",
        "final_status": "approved",
        "messages": _append_message(
            state,
            "decision",
            "approval",
            "Human reviewer approved the recommendation package.",
        ),
        "agent_cards": agents,
    }


async def finalize_rejected_node(state: WorkflowState) -> dict[str, Any]:
    writer = get_stream_writer()
    await _emit(
        writer,
        {
            "kind": "console",
            "agent": "decision",
            "style": "output",
            "message": "Human reviewer rejected the recommendation package. Closing the case for renegotiation.",
        },
        delay=STREAM_DELAY_SECONDS / 1.5,
    )
    agents = _clone_agents(state)
    _set_agent(
        agents,
        "decision",
        status="blocked",
        summary="Recommendation rejected",
        detail="Reviewer requested a revised position before the case can proceed.",
    )
    return {
        "current_phase": "completed",
        "final_status": "rejected",
        "messages": _append_message(
            state,
            "decision",
            "rejection",
            "Human reviewer rejected the recommendation package.",
        ),
        "agent_cards": agents,
    }


def build_workflow(checkpointer: Any):
    builder = StateGraph(WorkflowState)
    builder.add_node("research", research_node)
    builder.add_node("risk", risk_node)
    builder.add_node("decision", decision_node)
    builder.add_node("human_review", human_review_node)
    builder.add_node("finalize_approved", finalize_approved_node)
    builder.add_node("finalize_rejected", finalize_rejected_node)
    builder.add_edge(START, "research")
    builder.add_edge("research", "risk")
    builder.add_edge("risk", "decision")
    builder.add_edge("decision", "human_review")
    builder.add_edge("finalize_approved", END)
    builder.add_edge("finalize_rejected", END)
    return builder.compile(checkpointer=checkpointer)


class WorkflowService:
    def __init__(self, store: CaseStore, checkpointer: Any) -> None:
        self.store = store
        self.graph = build_workflow(checkpointer)

    async def start_case(self, case_id: str) -> None:
        case = await self.store.require_case(case_id)
        initial_state: WorkflowState = {
            "case_id": case.id,
            "title": case.title,
            "document_text": case.content,
            "submitted_at": case.created_at,
            "current_phase": "research",
            "risk_level": "pending",
            "decision": "",
            "final_status": "running",
            "research_summary": "",
            "risk_summary": "",
            "decision_summary": "",
            "sources": [],
            "risk_flags": [],
            "messages": [],
            "agent_cards": build_initial_agents(),
        }
        await self.store.set_snapshot(case_id, initial_state)
        await self.store.set_status(case_id, "running")
        await self._launch(case_id, initial_state)

    async def resume_case(self, case_id: str, approved: bool) -> None:
        existing_task = await self.store.get_run_task(case_id)
        if existing_task and not existing_task.done():
            await existing_task
        case = await self.store.require_case(case_id)
        if case.snapshot.get("final_status") != "awaiting_review":
            raise ValueError("Case is not waiting for human review.")
        await self.store.set_status(case_id, "running")
        await self._launch(case_id, Command(resume=approved))

    async def _launch(self, case_id: str, payload: Any) -> None:
        existing_task = await self.store.get_run_task(case_id)
        if existing_task and not existing_task.done():
            raise ValueError("Workflow is already running for this case.")
        task = asyncio.create_task(self._run(case_id, payload), name=f"workflow-{case_id}")
        task.add_done_callback(lambda _: asyncio.create_task(self.store.set_run_task(case_id, None)))
        await self.store.set_run_task(case_id, task)

    async def _run(self, case_id: str, payload: Any) -> None:
        config = {"configurable": {"thread_id": case_id}}
        try:
            async for part in self.graph.astream(
                payload,
                config=config,
                stream_mode=["custom", "values", "updates"],
                version="v2",
            ):
                await self._handle_stream_part(case_id, part)
            snapshot = await self.graph.aget_state(config)
            values = self._sanitize_state(snapshot.values or {})
            if values:
                await self.store.set_snapshot(case_id, values)
                await self._publish(case_id, "case_state", {"snapshot": values})
            awaiting_review = any(getattr(task, "interrupts", ()) for task in snapshot.tasks or ())
            if awaiting_review:
                await self.store.set_status(case_id, "awaiting_review")
                await self._publish(
                    case_id,
                    "workflow_status",
                    {"status": "awaiting_review", "message": "Waiting for human validation."},
                )
            elif not snapshot.next:
                final_status = values.get("final_status", "completed")
                await self.store.set_status(case_id, final_status)
                await self._publish(
                    case_id,
                    "workflow_status",
                    {"status": final_status, "message": "Workflow completed."},
                )
        except Exception as exc:
            await self.store.set_status(case_id, "error")
            await self._publish(case_id, "workflow_error", {"message": str(exc)})

    async def _handle_stream_part(self, case_id: str, part: dict[str, Any]) -> None:
        part_type = part["type"]
        if part_type == "custom":
            payload = jsonable_encoder(part["data"])
            await self._publish(case_id, payload["kind"], payload)
            return
        if part_type == "values":
            snapshot = self._sanitize_state(part["data"])
            await self.store.set_snapshot(case_id, snapshot)
            await self._publish(case_id, "case_state", {"snapshot": snapshot})
            return
        if part_type == "updates":
            await self._publish(case_id, "graph_update", {"update": jsonable_encoder(part["data"])})

    async def _publish(self, case_id: str, kind: str, payload: dict[str, Any]) -> None:
        event = {
            "id": uuid4().hex,
            "case_id": case_id,
            "kind": kind,
            "timestamp": utc_timestamp(),
            "payload": jsonable_encoder(payload),
        }
        await self.store.append_event(case_id, event)
        await self.store.broadcast(case_id, event)

    def _sanitize_state(self, state: dict[str, Any]) -> dict[str, Any]:
        cleaned = jsonable_encoder(state)
        cleaned.pop("__interrupt__", None)
        return cleaned
