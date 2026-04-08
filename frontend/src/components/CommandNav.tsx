export function CommandNav({
  activeCaseTitle,
  currentPhase,
  streamState,
}: {
  activeCaseTitle: string;
  currentPhase: string;
  streamState: "idle" | "connecting" | "live" | "closed";
}) {
  return (
    <nav className="command-nav" aria-label="Command center navigation">
      <a className="command-nav__brand" href="#top">
        <span className="command-nav__mark" />
        <span>AI Procurement Copilot</span>
      </a>

      <div className="command-nav__links">
        <a href="#intake">Intake</a>
        <a href="#console">Console</a>
        <a href="#agents">Agents</a>
      </div>

      <div className="command-nav__status">
        <span className={`stream-indicator stream-indicator--${streamState}`}>{streamState}</span>
        <span className="command-nav__phase">{currentPhase}</span>
        <span className="command-nav__case">{activeCaseTitle}</span>
      </div>
    </nav>
  );
}

