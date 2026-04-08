import { useEffect, useRef, useState } from "react";

import { AgentPanel } from "./components/AgentPanel";
import { CommandHeader } from "./components/CommandHeader";
import { CommandNav } from "./components/CommandNav";
import { ConsoleFeed } from "./components/ConsoleFeed";
import { DocumentViewer } from "./components/DocumentViewer";
import { OverviewStrip } from "./components/OverviewStrip";
import { TemplateDock } from "./components/TemplateDock";
import { ValidationBar } from "./components/ValidationBar";
import { AgentCard, AgentId, CaseRecord, CaseSnapshot, MockDocument, StreamEvent } from "./types";

const API_BASE = resolveApiBase();
const WS_BASE = (import.meta.env.VITE_WS_BASE_URL ?? API_BASE).replace(/^http/, "ws");
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
  const focusTitle = resolveFocusTitle(currentSnapshot);
  const focusCopy =
    currentSnapshot?.decision_summary ||
    currentSnapshot?.risk_summary ||
    currentSnapshot?.research_summary ||
    "Pick a seeded procurement case or paste a new submission to watch the live agent workflow kick in.";

  return (
    <div className="app-shell" id="top">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient ambient-c" />

      <CommandNav
        activeCaseTitle={currentSnapshot?.title ?? "No case running"}
        currentPhase={formatPhaseLabel(currentSnapshot?.current_phase ?? "standby")}
        streamState={streamState}
      />

      <CommandHeader
        focusCopy={focusCopy}
        focusTitle={focusTitle}
        phase={currentSnapshot?.current_phase ?? "standby"}
        streamState={streamState}
      />

      {errorMessage ? (
        <aside className="error-banner" aria-live="polite">
          {errorMessage}
        </aside>
      ) : null}

      <OverviewStrip
        activeCaseTitle={currentSnapshot?.title ?? "No case running"}
        decisionState={formatPhaseLabel(activeCase?.status ?? "standby")}
        riskLevel={(currentSnapshot?.risk_level ?? "pending").toUpperCase()}
      />

      <main className="dashboard-grid">
        <section className="glass-panel intake-column" id="intake" aria-labelledby="intake-title">
          <header className="panel-header">
            <section>
              <p className="eyebrow">Case Intake</p>
              <h2 id="intake-title">Document Dock</h2>
            </section>
            <span className="phase-pill">{activeCase?.status ?? "idle"}</span>
          </header>

          <TemplateDock
            composerBody={composerBody}
            composerTitle={composerTitle}
            isSubmitting={isSubmitting}
            onBodyChange={setComposerBody}
            onRun={() => void handleSubmit()}
            onSelectTemplate={applyTemplate}
            onTitleChange={setComposerTitle}
            selectedTemplateId={selectedTemplateId}
            templates={templates}
          />

          <DocumentViewer snapshot={currentSnapshot} />
        </section>

        <section className="glass-panel console-column" id="console" aria-labelledby="console-title">
          <header className="panel-header">
            <section>
              <p className="eyebrow">Live Feed</p>
              <h2 id="console-title">Streaming Console</h2>
            </section>
            <span className={`stream-indicator stream-indicator--${streamState}`}>{streamState}</span>
          </header>
          <ConsoleFeed events={feedEvents} />
        </section>

        <aside className="glass-panel agent-column" id="agents" aria-labelledby="agents-title">
          <header className="panel-header">
            <section>
              <p className="eyebrow">Agent Lanes</p>
              <h2 id="agents-title">Decision Stack</h2>
            </section>
            <span className={`risk-badge risk-${currentSnapshot?.risk_level ?? "pending"}`}>{currentSnapshot?.risk_level ?? "pending"}</span>
          </header>

          <section className="agent-stack" aria-label="Agent activity lanes">
            {agentCards.map((agent) => (
              <AgentPanel agent={agent} key={agent.id} />
            ))}
          </section>

          <ValidationBar onDecision={handleDecision} pending={isValidating} snapshot={currentSnapshot} />
        </aside>
      </main>
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

function resolveApiBase() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase;
  }

  if (import.meta.env.DEV && typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "127.0.0.1";
    return `${protocol}//${hostname}:8001`;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://127.0.0.1:8001";
}

function resolveFocusTitle(snapshot: CaseSnapshot | null) {
  if (!snapshot) {
    return "Ready for intake";
  }

  if (snapshot.final_status === "awaiting_review") {
    return "Reviewer handoff is active";
  }

  if (snapshot.final_status === "approved") {
    return "Recommendation approved";
  }

  if (snapshot.final_status === "rejected") {
    return "Recommendation rejected";
  }

  return `${formatPhaseLabel(snapshot.current_phase)} in motion`;
}

function formatPhaseLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
