import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { startWorker } = await import("./worker");
  await startWorker();
  console.info("[lankaslip] worker process running");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
