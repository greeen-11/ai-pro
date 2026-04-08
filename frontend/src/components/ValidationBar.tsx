import { CaseSnapshot } from "../types";

export function ValidationBar({
  snapshot,
  pending,
  onDecision,
}: {
  snapshot: CaseSnapshot | null;
  pending: boolean;
  onDecision: (approved: boolean) => Promise<void>;
}) {
  if (!snapshot) {
    return (
      <section className="validation-bar validation-bar--idle">
        <p className="eyebrow">Human Validation</p>
        <strong>No active review request.</strong>
        <span>The approval controls will arm once the decision agent pauses the graph.</span>
      </section>
    );
  }

  const isAwaitingReview = snapshot.final_status === "awaiting_review";
  const label =
    snapshot.final_status === "approved"
      ? "Approved"
      : snapshot.final_status === "rejected"
        ? "Rejected"
        : isAwaitingReview
          ? "Approval required"
          : "Monitoring";

  return (
    <section className={`validation-bar ${isAwaitingReview ? "validation-bar--active" : "validation-bar--idle"}`}>
      <p className="eyebrow">Human Validation</p>
      <strong>{label}</strong>
      <p>{snapshot.decision_summary || "No recommendation package has been generated yet."}</p>
      <div className="validation-actions">
        <button disabled={!isAwaitingReview || pending} onClick={() => void onDecision(true)} type="button">
          {pending ? "Sending..." : "Approve"}
        </button>
        <button
          className="button-secondary"
          disabled={!isAwaitingReview || pending}
          onClick={() => void onDecision(false)}
          type="button"
        >
          Reject
        </button>
      </div>
    </section>
  );
}
