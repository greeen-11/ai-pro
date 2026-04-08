import { useEffect, useRef } from "react";

import { StreamEvent } from "../types";

export function ConsoleFeed({ events }: { events: StreamEvent[] }) {
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = feedRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, [events]);

  return (
    <div className="console-feed" ref={feedRef}>
      {events.length === 0 ? (
        <div className="console-empty">
          <p>Waiting for live workflow events.</p>
          <span>Research, risk, and decision traces will stream here.</span>
        </div>
      ) : (
        events.map((event) => {
          const entry = describeEvent(event);
          return (
            <article className={`console-entry tone-${entry.tone}`} key={event.id}>
              <header className="console-entry__header">
                <span>{entry.label}</span>
                <time>{formatTime(event.timestamp)}</time>
              </header>
              <p>{entry.message}</p>
            </article>
          );
        })
      )}
    </div>
  );
}

function describeEvent(event: StreamEvent) {
  if (event.kind === "console") {
    return {
      tone: String(event.payload.style ?? "thought"),
      label: `${String(event.payload.agent ?? "system").toUpperCase()} / ${String(event.payload.style ?? "thought").toUpperCase()}`,
      message: String(event.payload.message ?? ""),
    };
  }

  if (event.kind === "agent_status") {
    return {
      tone: "status",
      label: `${String(event.payload.agent ?? "agent").toUpperCase()} / STATUS`,
      message: `${String(event.payload.headline ?? "")} ${String(event.payload.detail ?? "")}`.trim(),
    };
  }

  if (event.kind === "review_required") {
    return {
      tone: "review",
      label: "HUMAN REVIEW",
      message: `${String(event.payload.message ?? "")} Proposal: ${String(event.payload.proposal ?? "")}`.trim(),
    };
  }

  if (event.kind === "workflow_error") {
    return {
      tone: "error",
      label: "SYSTEM / ERROR",
      message: String(event.payload.message ?? "Unexpected workflow failure."),
    };
  }

  return {
    tone: "status",
    label: "SYSTEM / STATUS",
    message: String(event.payload.message ?? "Workflow updated."),
  };
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
