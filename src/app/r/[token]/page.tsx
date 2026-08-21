import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptDocument } from "@/components/receipt-document";
import { getPublicReceipt } from "@/server/domain/receipts";
import { paymentQrDataUrl } from "@/server/domain/qr";
import { getSignedReadUrl } from "@/server/storage";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const loaded = await getPublicReceipt(token);
  if (!loaded?.profile) {
    return { title: "Receipt", robots: { index: false, follow: false } };
  }
  return {
    title: `${loaded.profile.shopName} — Payment Receipt`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicReceiptPage({ params }: Params) {
  const { token } = await params;
  const loaded = await getPublicReceipt(token);
  if (!loaded?.receipt || !loaded.profile) {
    notFound();
  }

  const { receipt, profile, customer } = loaded;
  const pending = receipt.paymentStatus === "pending";
  const qr = pending
    ? await paymentQrDataUrl({
        lankaQrPayload: profile.lankaQrPayload,
        shopName: profile.shopName,
        amountCents: receipt.amountCents,
        referenceNumber: receipt.referenceNumber,
        bankName: profile.bankName,
        accountName: profile.accountName,
        accountNumber: profile.accountNumber,
        branch: profile.branch,
      })
    : null;

  let slipUrl: string | null = null;
  if (receipt.slipObjectKey) {
    slipUrl =
      (await getSignedReadUrl(receipt.slipObjectKey)) ??
      `/api/public/slips/${receipt.token}`;
  }

  const logoUrl = profile.logoKey
    ? `/api/public/logos/${receipt.token}`
    : null;

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

  return (
    <main className="min-h-full bg-[#efeae2] print:bg-white">
      <ReceiptDocument
        data={{
          token: receipt.token,
          shopName: profile.shopName,
          logoUrl,
          addressLines,
          contactLines,
          receiptTitle: profile.receiptTitle ?? "PAYMENT RECEIPT",
          receiptFooter:
            profile.receiptFooter ?? "Thank you for your payment.",
          authorizedBy: profile.authorizedBy,
          referenceNumber: receipt.referenceNumber,
          createdAt: receipt.createdAt,
          customerName: customer?.name ?? null,
          customerPhone: customer?.phoneE164 ?? null,
          invoiceId: receipt.invoiceId,
          itemDetails: receipt.itemDetails,
          amountCents: receipt.amountCents,
          paymentStatus: receipt.paymentStatus,
          slipUrl,
          pendingPay: pending
            ? {
                qrDataUrl: qr,
                bankName: profile.bankName,
                branch: profile.branch,
                accountName: profile.accountName,
                accountNumber: profile.accountNumber,
              }
            : null,
        }}
      />
    </main>
  );
}
