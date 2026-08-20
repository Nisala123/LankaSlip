import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLkr } from "@/server/domain/money";
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
    title: `${loaded.profile.shopName} receipt`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicReceiptPage({ params }: Params) {
  const { token } = await params;
  const loaded = await getPublicReceipt(token);
  if (!loaded?.receipt || !loaded.profile) {
    notFound();
  }

  const { receipt, profile } = loaded;
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

  return (
    <main className="mx-auto min-h-full w-full max-w-md px-4 py-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Receipt
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{profile.shopName}</h1>
      <p className="mt-1 text-sm text-muted">{receipt.referenceNumber}</p>

      <section className="mt-6 rounded-2xl bg-card p-5">
        <p className="text-sm text-muted">Amount</p>
        <p className="text-3xl font-semibold">LKR {formatLkr(receipt.amountCents)}</p>
        <p
          className={`mt-2 text-sm font-medium ${
            pending ? "text-pending" : "text-accent"
          }`}
        >
          {pending ? "Payment pending" : "Payment received"}
        </p>
        {receipt.invoiceId ? (
          <p className="mt-3 text-sm">Invoice {receipt.invoiceId}</p>
        ) : null}
        {receipt.itemDetails ? (
          <p className="mt-2 whitespace-pre-wrap text-sm">{receipt.itemDetails}</p>
        ) : null}
      </section>

      {slipUrl ? (
        <section className="mt-4 rounded-2xl bg-card p-4">
          <p className="mb-2 text-sm text-muted">Bank slip</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slipUrl} alt="Payment slip" className="w-full rounded-xl" />
        </section>
      ) : null}

      {pending ? (
        <section className="mt-4 rounded-2xl bg-card p-5">
          <h2 className="font-semibold">Pay now</h2>
          <p className="mt-1 text-sm text-muted">
            Scan the QR or transfer using the bank details below. Use the
            receipt number as the reference.
          </p>
          {qr ? (
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Payment QR" className="h-52 w-52" />
            </div>
          ) : null}
          <dl className="mt-4 space-y-2 text-sm">
            {profile.bankName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Bank</dt>
                <dd>{profile.bankName}</dd>
              </div>
            ) : null}
            {profile.branch ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Branch</dt>
                <dd>{profile.branch}</dd>
              </div>
            ) : null}
            {profile.accountName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Account name</dt>
                <dd className="text-right">{profile.accountName}</dd>
              </div>
            ) : null}
            {profile.accountNumber ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Account no.</dt>
                <dd>{profile.accountNumber}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Reference</dt>
              <dd>{receipt.referenceNumber}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
