export function OverviewStrip({
  activeCaseTitle,
  decisionState,
  riskLevel,
}: {
  activeCaseTitle: string;
  decisionState: string;
  riskLevel: string;
}) {
  return (
    <section className="overview-strip" aria-label="Case overview">
      <article className="overview-chip">
        <span>Active Case</span>
        <strong>{activeCaseTitle}</strong>
      </article>
      <article className="overview-chip">
        <span>Risk Posture</span>
        <strong>{riskLevel}</strong>
      </article>
      <article className="overview-chip">
        <span>Decision State</span>
        <strong>{decisionState}</strong>
      </article>
    </section>
  );
}

