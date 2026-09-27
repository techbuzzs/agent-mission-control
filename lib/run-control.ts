type ActiveRun = { controller: AbortController; startedAt: string };

const activeRuns = new Map<string, ActiveRun>();

export function beginRun(runId: string) {
  const controller = new AbortController();
  activeRuns.set(runId, { controller, startedAt: new Date().toISOString() });
  return controller;
}

export function finishRun(runId: string) {
  activeRuns.delete(runId);
}

export function cancelRun(runId: string) {
  const active = activeRuns.get(runId);
  if (!active) return false;
  active.controller.abort("Cancelled from Mission Control");
  return true;
}

export function isCancelled(signal: AbortSignal) {
  return signal.aborted;
}
