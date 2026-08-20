export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

function isLocalhostUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Public site origin — prefers real deploy URL over leftover localhost env. */
export function appUrl(): string {
  const configured = process.env.APP_URL ?? process.env.BETTER_AUTH_URL;
  if (configured && !isLocalhostUrl(configured)) {
    return stripTrailingSlash(configured);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (configured) {
    return stripTrailingSlash(configured);
  }
  return "http://localhost:3000";
}

/** Origins allowed by Better Auth CSRF checks (production + previews). */
export function authTrustedOrigins(): string[] {
  const origins = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // ignore invalid URLs
    }
  };

  add(process.env.APP_URL);
  add(process.env.BETTER_AUTH_URL);
  add(appUrl());
  if (process.env.VERCEL_URL) {
    add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_BRANCH_URL) {
    add(`https://${process.env.VERCEL_BRANCH_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  add("http://localhost:3000");
  return [...origins];
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
