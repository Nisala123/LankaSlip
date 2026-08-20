export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.SKIP_WORKER === "1") return;
  if (!process.env.DATABASE_URL) return;

  const { startWorker } = await import("./server/jobs/worker");
  await startWorker();
}
