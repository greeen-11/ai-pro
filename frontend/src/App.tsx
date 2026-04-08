import { useEffect, useRef, useState } from "react";

import { AgentPanel } from "./components/AgentPanel";
import { ConsoleFeed } from "./components/ConsoleFeed";
import { DocumentViewer } from "./components/DocumentViewer";
import { ValidationBar } from "./components/ValidationBar";
import { AgentCard, AgentId, CaseRecord, CaseSnapshot, MockDocument, StreamEvent } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const AGENT_ORDER: AgentId[] = ["research", "risk", "decision"];

export default function App() {
  const [templates, setTemplates] = useState<MockDocument[]>([]);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [feedEvents, setFeedEvents] = useState<StreamEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [streamState, setStreamState] = useState<"idle" | "connecting" | "live" | "closed">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const seenEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!activeCase) {
      setStreamState("idle");
      return;
    }

    setStreamState("connecting");
    const socket = new WebSocket(`${WS_BASE}/ws/stream/${activeCase.id}`);

    socket.onopen = () => {
      setStreamState("live");
    };

    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as StreamEvent;
      if (event.id && seenEventIds.current.has(event.id)) {
        return;
      }

      if (event.id) {
        seenEventIds.current.add(event.id);
      }

      if (shouldDisplayEvent(event)) {
        setFeedEvents((current) => [...current, event].slice(-240));
      }

      setActiveCase((current) => applyEvent(current, event));
      if (event.kind === "workflow_error") {
        setErrorMessage(String(event.payload.message ?? "The workflow encountered an unexpected error."));
      }
    };

    socket.onerror = () => {
      setStreamState("closed");
    };

    socket.onclose = () => {
      setStreamState("closed");
    };

    return () => {
      socket.close();
    };
  }, [activeCase?.id]);

  const agentCards = AGENT_ORDER.map((agentId) => activeCase?.snapshot.agent_cards?.[agentId] ?? fallbackAgent(agentId));

  async function loadTemplates() {
    try {
      const response = await fetch(`${API_BASE}/api/mock-documents`);
      const payload = (await response.json()) as { items: MockDocument[]; detail?: string };
      if (!response.ok) {
        throw new Error(payload.detail ?? "Unable to load mock procurement cases.");
      }
      setTemplates(payload.items);
      if (payload.items[0]) {
        const starter = payload.items[0];
        setSelectedTemplateId(starter.id);
        setComposerTitle(starter.title);
        setComposerBody(starter.content);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load mock procurement cases.");
    }
  }

  async function handleSubmit() {
    if (!composerBody.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: composerTitle || undefined,
          content: composerBody || undefined,
          template_id: selectedTemplateId ?? undefined,
        }),
      });
      const payload = (await response.json()) as { case?: CaseRecord; detail?: string };
      if (!response.ok || !payload.case) {
        throw new Error(payload.detail ?? "Unable to start procurement workflow.");
      }
      seenEventIds.current = new Set(
        payload.case.events
          .filter(shouldDisplayEvent)
          .map((event) => event.id)
          .filter(Boolean),
      );
      setFeedEvents(payload.case.events.filter(shouldDisplayEvent));
      setActiveCase(payload.case);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start procurement workflow.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDecision(approved: boolean) {
    if (!activeCase) {
      return;
    }

    setIsValidating(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/cases/${activeCase.id}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approved }),
      });
      const payload = (await response.json()) as { case?: CaseRecord; detail?: string };
      if (!response.ok || !payload.case) {
        throw new Error(payload.detail ?? "Unable to send human review decision.");
      }
      setActiveCase(payload.case);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send human review decision.");
    } finally {
      setIsValidating(false);
    }
  }

  function applyTemplate(template: MockDocument) {
    setSelectedTemplateId(template.id);
    setComposerTitle(template.title);
    setComposerBody(template.content);
  }

  const currentSnapshot = activeCase?.snapshot ?? null;

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient ambient-c" />

      <header className="hero-bar">
        <div>
          <p className="eyebrow">Multi-Agent Command Center</p>
          <h1>AI Procurement Copilot</h1>
          <p className="hero-copy">
            LangGraph-backed procurement triage with streamed agent traces, human review gating, and deterministic mock outputs for a stable demo.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricChip label="Mode" value="Mocked Agents" />
          <MetricChip label="State" value="SQLite Checkpoints" />
          <MetricChip label="Stream" value={streamState} />
          <MetricChip label="Phase" value={currentSnapshot?.current_phase ?? "standby"} />
        </div>
      </header>

      {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

      <main className="dashboard-grid">
        <section className="glass-panel intake-column">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Case Intake</p>
              <h2>Document Dock</h2>
            </div>
            <span className="phase-pill">{activeCase?.status ?? "idle"}</span>
          </header>

          <div className="template-grid">
            {templates.map((template) => (
              <button
                className={`template-card ${selectedTemplateId === template.id ? "template-card--active" : ""}`}
                key={template.id}
                onClick={() => applyTemplate(template)}
                type="button"
              >
                <span className="template-card__category">{template.category}</span>
                <strong>{template.title}</strong>
                <p>{template.summary}</p>
              </button>
            ))}
          </div>

          <div className="composer-grid">
            <label className="field">
              <span>Case Title</span>
              <input
                onChange={(event) => setComposerTitle(event.target.value)}
                placeholder="Paste or rename the procurement case"
                value={composerTitle}
              />
            </label>

            <label className="field field-textarea">
              <span>Submission</span>
              <textarea
                onChange={(event) => setComposerBody(event.target.value)}
                placeholder="Paste procurement notes, contract language, or an RFP response"
                value={composerBody}
              />
            </label>

            <div className="composer-actions">
              <button disabled={isSubmitting || !composerBody.trim()} onClick={() => void handleSubmit()} type="button">
                {isSubmitting ? "Launching..." : "Run Analysis"}
              </button>
              <span>Cases start with mocked agent outputs and a real LangGraph pause/resume cycle.</span>
            </div>
          </div>

          <DocumentViewer snapshot={currentSnapshot} />
        </section>

        <section className="glass-panel console-column">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Live Feed</p>
              <h2>Streaming Console</h2>
            </div>
            <span className={`stream-indicator stream-indicator--${streamState}`}>{streamState}</span>
          </header>
          <ConsoleFeed events={feedEvents} />
        </section>

        <aside className="glass-panel agent-column">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Agent Lanes</p>
              <h2>Decision Stack</h2>
            </div>
            <span className={`risk-badge risk-${currentSnapshot?.risk_level ?? "pending"}`}>{currentSnapshot?.risk_level ?? "pending"}</span>
          </header>

          <div className="agent-stack">
            {agentCards.map((agent) => (
              <AgentPanel agent={agent} key={agent.id} />
            ))}
          </div>

          <ValidationBar onDecision={handleDecision} pending={isValidating} snapshot={currentSnapshot} />
        </aside>
      </main>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function shouldDisplayEvent(event: StreamEvent) {
  return !["case_state", "graph_update"].includes(event.kind);
}

function applyEvent(current: CaseRecord | null, event: StreamEvent): CaseRecord | null {
  if (!current || current.id !== event.case_id) {
    return current;
  }

  if (event.kind === "case_state" && event.payload.snapshot) {
    const snapshot = event.payload.snapshot as CaseSnapshot;
    return {
      ...current,
      status: snapshot.final_status as CaseRecord["status"],
      snapshot,
    };
  }

  if (event.kind === "agent_status") {
    const agentId = String(event.payload.agent);
    const existingAgent = current.snapshot.agent_cards[agentId] ?? fallbackAgent(agentId as AgentId);
    return {
      ...current,
      snapshot: {
        ...current.snapshot,
        agent_cards: {
          ...current.snapshot.agent_cards,
          [agentId]: {
            ...existingAgent,
            status: String(event.payload.status) as AgentCard["status"],
            summary: String(event.payload.headline ?? existingAgent.summary),
            detail: String(event.payload.detail ?? existingAgent.detail),
            updated_at: event.timestamp,
          },
        },
      },
    };
  }

  if (event.kind === "review_required") {
    return {
      ...current,
      status: "awaiting_review",
      snapshot: {
        ...current.snapshot,
        final_status: "awaiting_review",
        decision_summary: String(event.payload.proposal ?? current.snapshot.decision_summary),
        decision: String(event.payload.proposal ?? current.snapshot.decision),
      },
    };
  }

  if (event.kind === "workflow_status") {
    const nextStatus = String(event.payload.status ?? current.status) as CaseRecord["status"];
    return {
      ...current,
      status: nextStatus,
      snapshot: {
        ...current.snapshot,
        final_status: nextStatus,
      },
    };
  }

  if (event.kind === "workflow_error") {
    return {
      ...current,
      status: "error",
      snapshot: {
        ...current.snapshot,
        final_status: "error",
      },
    };
  }

  return current;
}

function fallbackAgent(agentId: AgentId): AgentCard {
  const labels: Record<AgentId, { name: string; summary: string; detail: string }> = {
    research: {
      name: "Research Agent",
      summary: "Waiting for intake",
      detail: "Context retrieval will begin after the case is submitted.",
    },
    risk: {
      name: "Risk Agent",
      summary: "Waiting for research",
      detail: "Risk scoring will light up after the research lane completes.",
    },
    decision: {
      name: "Decision Agent",
      summary: "Waiting for dossier",
      detail: "The decision package is idle until the risk register lands.",
    },
  };

  return {
    id: agentId,
    name: labels[agentId].name,
    status: "idle",
    summary: labels[agentId].summary,
    detail: labels[agentId].detail,
    updated_at: new Date().toISOString(),
  };
}
