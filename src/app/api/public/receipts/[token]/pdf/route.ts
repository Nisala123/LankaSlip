import { NextResponse } from "next/server";
import { getPublicReceipt } from "@/server/domain/receipts";
import { buildReceiptPdf } from "@/server/domain/receipt-pdf";
import { readObjectBuffer } from "@/server/storage/slips";
import { clientKey, rateLimit } from "@/server/security/rate-limit";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const limited = rateLimit(clientKey(request, "receipt-pdf"), 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const loaded = await getPublicReceipt(token);
  if (!loaded?.receipt || !loaded.profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { receipt, profile, customer } = loaded;
  let logoBuffer: Buffer | null = null;
  if (profile.logoKey) {
    logoBuffer = (await readObjectBuffer(profile.logoKey)) ?? null;
  }

  const addressLines = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
  ].filter((line): line is string => Boolean(line?.trim()));

  const contactLines = [
    profile.contactPhone,
    profile.contactEmail,
    profile.website,
  ].filter((line): line is string => Boolean(line?.trim()));

  try {
    const pdf = await buildReceiptPdf({
      shopName: profile.shopName,
      logoBuffer,
      addressLines,
      contactLines,
      receiptTitle: profile.receiptTitle ?? "PAYMENT RECEIPT",
      receiptFooter: profile.receiptFooter ?? "Thank you for your payment.",
      authorizedBy: profile.authorizedBy,
      referenceNumber: receipt.referenceNumber,
      createdAt: receipt.createdAt,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phoneE164 ?? null,
      invoiceId: receipt.invoiceId,
      itemDetails: receipt.itemDetails,
      amountCents: receipt.amountCents,
      paymentStatus: receipt.paymentStatus,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receipt.referenceNumber}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("receipt pdf failed", error);
    return NextResponse.json(
      { error: "Could not generate PDF" },
      { status: 500 },
    );
  }
}
