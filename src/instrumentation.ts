export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { shouldStartBackgroundWorker } = await import("./lib/env");
  if (!shouldStartBackgroundWorker()) return;

  const { startWorker } = await import("./server/jobs/worker");
  await startWorker();
}
