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
