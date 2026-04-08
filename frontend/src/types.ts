export type AgentId = "research" | "risk" | "decision";
export type AgentStatus =
  | "idle"
  | "thinking"
  | "outputting"
  | "awaiting_human"
  | "completed"
  | "blocked";

export interface SourceItem {
  title: string;
  detail: string;
  url: string;
}

export interface RiskFlag {
  title: string;
  severity: "low" | "medium" | "high";
  detail: string;
  keyword: string;
}

export interface AgentCard {
  id: AgentId;
  name: string;
  status: AgentStatus;
  summary: string;
  detail: string;
  updated_at: string;
}

export interface CaseSnapshot {
  case_id: string;
  title: string;
  document_text: string;
  submitted_at: string;
  current_phase: string;
  risk_level: "pending" | "low" | "medium" | "high";
  decision: string;
  final_status:
    | "queued"
    | "running"
    | "awaiting_review"
    | "approved"
    | "rejected"
    | "completed"
    | "error";
  research_summary: string;
  risk_summary: string;
  decision_summary: string;
  sources: SourceItem[];
  risk_flags: RiskFlag[];
  messages: Array<{
    agent: string;
    stage: string;
    content: string;
    timestamp: string;
  }>;
  agent_cards: Record<string, AgentCard>;
}

export interface StreamEvent {
  id: string;
  case_id: string;
  kind: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface CaseRecord {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  status: CaseSnapshot["final_status"];
  snapshot: CaseSnapshot;
  events: StreamEvent[];
}

export interface MockDocument {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  metadata: Record<string, string>;
}
