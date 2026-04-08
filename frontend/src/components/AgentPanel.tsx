import { AgentCard } from "../types";

const statusLabels: Record<AgentCard["status"], string> = {
  idle: "Idle",
  thinking: "Thinking",
  outputting: "Outputting",
  awaiting_human: "Awaiting Review",
  completed: "Complete",
  blocked: "Blocked",
};

export function AgentPanel({ agent }: { agent: AgentCard }) {
  return (
    <article className={`agent-card status-${agent.status}`}>
      <header className="agent-card__header">
        <div>
          <p className="eyebrow">{agent.name}</p>
          <h3>{agent.summary}</h3>
        </div>
        <span className="status-pill">{statusLabels[agent.status]}</span>
      </header>
      <p className="agent-card__detail">{agent.detail}</p>
      <footer className="agent-card__footer">
        <span className="agent-pulse" />
        <span>Last update {formatTime(agent.updated_at)}</span>
      </footer>
    </article>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
