import type { BriefingRun } from "./types";

export const DEMO_RUN: BriefingRun = {
  id: "run-demo-0927",
  traceId: "71a948e34f4f4d52b9b8a2625e21dc10",
  status: "review",
  startedAt: new Date(Date.now() - 94000).toISOString(),
  completedAt: new Date().toISOString(),
  newArticles: 7,
  duplicates: 3,
  selected: 3,
  qualityScore: 87,
  inputTokens: 3240,
  outputTokens: 612,
  estimatedCostUsd: 0.00032,
  title: "AI & data engineering briefing",
  markdown: "## This week in practical AI and data engineering\n\nThree themes stood out: production teams are treating evaluation as infrastructure, local-first AI is becoming easier to operate, and event-streaming systems are absorbing more AI workloads.\n\n### Evaluation moves into the delivery loop\nTeams are connecting model evaluations to deployment gates instead of running them as occasional benchmarks. The useful shift is operational: quality regressions become visible alongside latency and cost.\n\n### Local AI gets an operations layer\nLocal inference is moving beyond model runners toward observable, repeatable workflows. The winning tools make resource limits and failure states explicit rather than hiding them.\n\n### Streaming meets agent workflows\nKafka remains a natural backbone for durable agent events. A traceable event log makes handoffs, retries, and human approval easier to reconstruct.\n\n**Editorial note:** the common thread is control. Teams want agents they can inspect, constrain, and improve—not opaque automation.",
  events: [
    { id: "e1", runId: "run-demo-0927", traceId: "71a948e34f4f4d52b9b8a2625e21dc10", kind: "source.checked", actor: "Sources", target: "Scout", message: "4 feeds checked", createdAt: new Date(Date.now() - 92000).toISOString(), durationMs: 842 },
    { id: "e2", runId: "run-demo-0927", traceId: "71a948e34f4f4d52b9b8a2625e21dc10", kind: "article.duplicate", actor: "Memory", target: "Scout", message: "3 previously-seen articles ignored", createdAt: new Date(Date.now() - 81000).toISOString() },
    { id: "e3", runId: "run-demo-0927", traceId: "71a948e34f4f4d52b9b8a2625e21dc10", kind: "agent.message", actor: "Scout", target: "Curator", message: "7 new articles ready", createdAt: new Date(Date.now() - 74000).toISOString(), tokens: 0 },
    { id: "e4", runId: "run-demo-0927", traceId: "71a948e34f4f4d52b9b8a2625e21dc10", kind: "agent.completed", actor: "Curator", target: "Writer", message: "Selected 3 distinct stories", createdAt: new Date(Date.now() - 43000).toISOString(), durationMs: 18420, tokens: 2140 },
    { id: "e5", runId: "run-demo-0927", traceId: "71a948e34f4f4d52b9b8a2625e21dc10", kind: "draft.created", actor: "Writer", target: "Reviewer", message: "Briefing ready for review", createdAt: new Date(Date.now() - 12000).toISOString(), durationMs: 26510, tokens: 1712 },
    { id: "e6", runId: "run-demo-0927", traceId: "71a948e34f4f4d52b9b8a2625e21dc10", kind: "quality.scored", actor: "Quality", target: "Reviewer", message: "Quality score 87/100", createdAt: new Date().toISOString() },
  ],
};

