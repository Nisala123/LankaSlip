import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createReceipt, createReceiptSchema, listRecentReceipts } from "@/server/domain/receipts";
import { PhoneError } from "@/server/domain/phones";
import { MoneyError } from "@/server/domain/money";
import { requireVendorApi } from "@/server/auth/session";
import { clientKey, rateLimit } from "@/server/security/rate-limit";
import { storeSlip } from "@/server/storage/slips";
import { formatLkr } from "@/server/domain/money";
import { maskPhone } from "@/server/domain/phones";
import {
  buildWhatsAppShareUrl,
  receiptPublicUrl,
} from "@/server/channels/urls";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";

async function shopNameForTenant(tenantId: string) {
  const [profile] = await db
    .select({ shopName: vendorProfiles.shopName })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, tenantId))
    .limit(1);
  return profile?.shopName ?? "Shop";
}

function serializeReceipt(
  row:
    | Awaited<ReturnType<typeof listRecentReceipts>>[number]
    | {
        receipt: {
          id: string;
          token: string;
          referenceNumber: string;
          amountCents: number;
          currency: string;
          invoiceId: string | null;
          itemDetails: string | null;
          paymentStatus: string;
          createdAt: Date;
        };
        message: {
          id: string;
          status: string;
          error: string | null;
          channel: string;
        } | null;
        customer: { phoneE164: string; name: string | null } | null;
      },
  shopName: string,
) {
  const receiptUrl = receiptPublicUrl(row.receipt.token);
  const invoiceId = row.receipt.invoiceId ?? row.receipt.referenceNumber;
  return {
    id: row.receipt.id,
    token: row.receipt.token,
    referenceNumber: row.receipt.referenceNumber,
    amount: formatLkr(row.receipt.amountCents),
    amountCents: row.receipt.amountCents,
    currency: row.receipt.currency,
    invoiceId: row.receipt.invoiceId,
    itemDetails: row.receipt.itemDetails,
    paymentStatus: row.receipt.paymentStatus,
    createdAt: row.receipt.createdAt,
    messageStatus: row.message?.status ?? "queued",
    messageError: row.message?.error ?? null,
    channel: row.message?.channel ?? null,
    customerPhone: row.customer ? maskPhone(row.customer.phoneE164) : null,
    customerName: row.customer?.name ?? null,
    receiptUrl,
    whatsappShareUrl: row.customer
      ? buildWhatsAppShareUrl({
          toE164: row.customer.phoneE164,
          shopName,
          amountCents: row.receipt.amountCents,
          paymentStatus: row.receipt.paymentStatus as "received" | "pending",
          invoiceId,
          receiptUrl,
        })
      : null,
  };
}

export async function GET() {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const shopName = await shopNameForTenant(session.user.tenantId);
  const rows = await listRecentReceipts(session.user.tenantId, 20);
  return NextResponse.json({
    receipts: rows.map((row) => serializeReceipt(row, shopName)),
  });
}

export async function POST(request: Request) {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limited = rateLimit(`send:${session.user.id}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many sends. Wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limited.retryAfterMs ?? 0) / 1000)),
        },
      },
    );
  }

  try {
    const form = await request.formData();
    const slip = form.get("slip");
    let slipObjectKey: string | undefined;
    if (slip instanceof File && slip.size > 0) {
      const stored = await storeSlip(slip);
      slipObjectKey = stored.key;
    }

    const parsed = createReceiptSchema.safeParse({
      phone: form.get("phone"),
      amount: form.get("amount"),
      itemDetails: form.get("itemDetails") || undefined,
      invoiceId: form.get("invoiceId") || undefined,
      paymentStatus: form.get("paymentStatus"),
      customerName: form.get("customerName") || undefined,
      slipObjectKey,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid receipt" },
        { status: 400 },
      );
    }

    const result = await createReceipt({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      input: parsed.data,
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    const shopName = await shopNameForTenant(session.user.tenantId);

    return NextResponse.json({
      replayed: result.replayed,
      receipt: serializeReceipt(
        {
          receipt: result.receipt,
          message: result.message,
          customer: result.customer,
        },
        shopName,
      ),
    });
  } catch (error) {
    if (error instanceof PhoneError || error instanceof MoneyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Could not create receipt";
    console.error("[create-receipt]", message, clientKey(request));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
