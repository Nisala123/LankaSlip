import { NextResponse } from "next/server";
import { requireVendorApi } from "@/server/auth/session";
import { getReceiptForVendor, retryMessage } from "@/server/domain/receipts";
import { formatLkr } from "@/server/domain/money";
import { maskPhone } from "@/server/domain/phones";
import { rateLimit } from "@/server/security/rate-limit";
import {
  buildWhatsAppShareUrl,
  receiptPublicUrl,
} from "@/server/channels/urls";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { id } = await params;
  const loaded = await getReceiptForVendor(session.user.tenantId, id);
  if (!loaded?.receipt || !loaded.customer) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const [profile] = await db
    .select({ shopName: vendorProfiles.shopName })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, session.user.tenantId))
    .limit(1);

  const receiptUrl = receiptPublicUrl(loaded.receipt.token);
  const invoiceId =
    loaded.receipt.invoiceId ?? loaded.receipt.referenceNumber;

  return NextResponse.json({
    receipt: {
      id: loaded.receipt.id,
      token: loaded.receipt.token,
      referenceNumber: loaded.receipt.referenceNumber,
      amount: formatLkr(loaded.receipt.amountCents),
      paymentStatus: loaded.receipt.paymentStatus,
      messageStatus: loaded.message?.status ?? "queued",
      messageError: loaded.message?.error ?? null,
      channel: loaded.message?.channel ?? null,
      customerPhone: maskPhone(loaded.customer.phoneE164),
      receiptUrl,
      whatsappShareUrl: buildWhatsAppShareUrl({
        toE164: loaded.customer.phoneE164,
        shopName: profile?.shopName ?? "Shop",
        amountCents: loaded.receipt.amountCents,
        paymentStatus: loaded.receipt.paymentStatus as "received" | "pending",
        invoiceId,
        receiptUrl,
      }),
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const limited = rateLimit(`retry:${session.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many retries" }, { status: 429 });
  }
  const { id } = await params;
  const url = new URL(request.url);
  if (url.searchParams.get("action") !== "retry") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const queued = await retryMessage(session.user.tenantId, id);
  if (!queued) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, messageStatus: queued.status });
}
