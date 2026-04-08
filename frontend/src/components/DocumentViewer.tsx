import { Fragment } from "react";

import { CaseSnapshot } from "../types";

export function DocumentViewer({ snapshot }: { snapshot: CaseSnapshot | null }) {
  if (!snapshot) {
    return (
      <section className="document-panel document-panel--empty">
        <p>No active case.</p>
        <span>Load a mock document or paste your own procurement intake to begin.</span>
      </section>
    );
  }

  return (
    <section className="document-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Document Context</p>
          <h2>{snapshot.title}</h2>
        </div>
        <span className={`risk-badge risk-${snapshot.risk_level}`}>{snapshot.risk_level}</span>
      </header>

      <div className="document-summaries">
        <article className="summary-card">
          <p className="eyebrow">Research</p>
          <p>{snapshot.research_summary || "Pending research output."}</p>
        </article>
        <article className="summary-card">
          <p className="eyebrow">Risk</p>
          <p>{snapshot.risk_summary || "Risk assessment will populate after the research pass."}</p>
        </article>
        <article className="summary-card">
          <p className="eyebrow">Decision</p>
          <p>{snapshot.decision_summary || "Recommendation package not generated yet."}</p>
        </article>
      </div>

      <div className="document-body">
        <p className="eyebrow">Submission</p>
        <div className="document-copy">{highlightText(snapshot.document_text, snapshot.risk_flags.map((flag) => flag.keyword))}</div>
      </div>

      <div className="document-meta-grid">
        <article className="glass-list">
          <header className="glass-list__header">
            <p className="eyebrow">Sources</p>
            <span>{snapshot.sources.length}</span>
          </header>
          <div className="glass-list__body">
            {snapshot.sources.map((source) => (
              <div key={source.title} className="glass-list__item">
                <strong>{source.title}</strong>
                <p>{source.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-list">
          <header className="glass-list__header">
            <p className="eyebrow">Risk Flags</p>
            <span>{snapshot.risk_flags.length}</span>
          </header>
          <div className="glass-list__body">
            {snapshot.risk_flags.map((flag) => (
              <div key={`${flag.title}-${flag.keyword}`} className="glass-list__item">
                <strong>{flag.title}</strong>
                <p>{flag.detail}</p>
                <span className={`severity severity-${flag.severity}`}>{flag.severity}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function highlightText(text: string, terms: string[]) {
  const uniqueTerms = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term, index, values) => values.indexOf(term) === index);

  if (uniqueTerms.length === 0) {
    return <pre>{text}</pre>;
  }

  const pattern = new RegExp(`(${uniqueTerms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <pre>
      {parts.map((part, index) =>
        uniqueTerms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
          <mark key={`${part}-${index}`}>{part}</mark>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        ),
      )}
    </pre>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
