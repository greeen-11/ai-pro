function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <li className="metric-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

export function CommandHeader({
  focusCopy,
  focusTitle,
  phase,
  streamState,
}: {
  focusCopy: string;
  focusTitle: string;
  phase: string;
  streamState: "idle" | "connecting" | "live" | "closed";
}) {
  return (
    <header className="hero-bar">
      <section>
        <p className="eyebrow">Multi-Agent Command Center</p>
        <h1>AI Procurement Copilot</h1>
        <p className="hero-copy">
          LangGraph-backed procurement triage with streamed agent traces, human review gating, and deterministic mock outputs for a stable demo.
        </p>
      </section>

      <aside className="hero-side">
        <ul className="hero-metrics" aria-label="Workflow metrics">
          <MetricChip label="Mode" value="Mocked Agents" />
          <MetricChip label="State" value="SQLite Checkpoints" />
          <MetricChip label="Stream" value={streamState} />
          <MetricChip label="Phase" value={phase} />
        </ul>

        <article className="hero-focus-card">
          <p className="eyebrow">Live Focus</p>
          <strong>{focusTitle}</strong>
          <p>{focusCopy}</p>
        </article>
      </aside>
    </header>
  );
}

