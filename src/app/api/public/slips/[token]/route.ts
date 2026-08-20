import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getPublicReceipt } from "@/server/domain/receipts";
import { getSignedReadUrl, streamLocalObject } from "@/server/storage";
import { clientKey, rateLimit } from "@/server/security/rate-limit";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const limited = rateLimit(clientKey(request, "slip"), 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { token } = await params;
  const loaded = await getPublicReceipt(token);
  if (!loaded?.receipt.slipObjectKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signed = await getSignedReadUrl(loaded.receipt.slipObjectKey);
  if (signed) {
    return NextResponse.redirect(signed, 302);
  }

  const stream = streamLocalObject(loaded.receipt.slipObjectKey);
  if (!stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
