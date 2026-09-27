export type RunStatus = "idle" | "running" | "review" | "approved" | "rejected" | "failed";

export type EventKind =
  | "source.checked"
  | "article.discovered"
  | "article.duplicate"
  | "agent.started"
  | "agent.message"
  | "agent.completed"
  | "draft.created"
  | "quality.scored"
  | "feedback.recorded";

export interface MissionEvent {
  id: string;
  runId: string;
  traceId: string;
  kind: EventKind;
  actor: string;
  target: string;
  message: string;
  createdAt: string;
  durationMs?: number;
  tokens?: number;
}

export interface BriefingRun {
  id: string;
  traceId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  newArticles: number;
  duplicates: number;
  selected: number;
  qualityScore: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  title: string;
  markdown: string;
  events: MissionEvent[];
}

export interface RunHistoryItem {
  id: string;
  traceId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  qualityScore: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  title: string;
  markdown: string;
  feedbackVerdict?: string;
  feedbackRating?: number;
  events?: MissionEvent[];
}
