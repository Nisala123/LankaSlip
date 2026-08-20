export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

export type DispatchChannelName = "sms" | "stub" | "whatsapp";

export function dispatchChannel(): DispatchChannelName {
  const value = process.env.DISPATCH_CHANNEL?.trim().toLowerCase();
  if (value === "whatsapp") return "whatsapp";
  if (value === "stub") return "stub";
  return "sms";
}

/** queue = pg-boss worker; sync = send inside the HTTP request (Vercel-friendly). */
export function dispatchMode(): "queue" | "sync" {
  const value = process.env.DISPATCH_MODE?.trim().toLowerCase();
  if (value === "sync") return "sync";
  if (value === "queue") return "queue";
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "sync";
  }
  return "queue";
}

export function shouldStartBackgroundWorker() {
  if (process.env.SKIP_WORKER === "1") return false;
  if (dispatchMode() === "sync") return false;
  if (process.env.VERCEL === "1") return false;
  return Boolean(process.env.DATABASE_URL);
}
