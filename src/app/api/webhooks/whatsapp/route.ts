import { NextResponse } from "next/server";
import { applyProviderStatus } from "@/server/domain/receipts";
import { verifyWhatsAppSignature } from "@/server/security/webhook";
import { clientKey, rateLimit } from "@/server/security/rate-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "wa-webhook"), 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const raw = Buffer.from(await request.arrayBuffer());
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (process.env.DISPATCH_CHANNEL === "whatsapp" && !appSecret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }
  if (appSecret) {
    const ok = verifyWhatsAppSignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(raw.toString("utf8")) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id: string;
            status: string;
            errors?: Array<{ title?: string; message?: string }>;
          }>;
        };
      }>;
    }>;
  };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        await applyProviderStatus({
          providerMessageId: status.id,
          status: status.status,
          error: status.errors?.[0]?.title ?? status.errors?.[0]?.message,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
