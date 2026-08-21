import { formatLkr } from "@/server/domain/money";
import { formatReceiptDate } from "@/server/domain/dates";
import { DownloadReceiptPdfButton } from "@/components/download-receipt-pdf-button";

export type ReceiptDocumentData = {
  token: string;
  shopName: string;
  logoUrl: string | null;
  addressLines: string[];
  contactLines: string[];
  receiptTitle: string;
  receiptFooter: string;
  authorizedBy: string | null;
  referenceNumber: string;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  invoiceId: string | null;
  itemDetails: string | null;
  amountCents: number;
  paymentStatus: "received" | "pending" | string;
  slipUrl: string | null;
  pendingPay?: {
    qrDataUrl: string | null;
    bankName: string | null;
    branch: string | null;
    accountName: string | null;
    accountNumber: string | null;
  } | null;
};

export function ReceiptDocument({ data }: { data: ReceiptDocumentData }) {
  const pending = data.paymentStatus === "pending";
  const amount = `LKR ${formatLkr(data.amountCents)}`;
  const description =
    data.itemDetails?.trim() ||
    (data.invoiceId
      ? `Payment against invoice ${data.invoiceId}`
      : "Payment received");

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 print:max-w-none print:p-0">
      <div className="receipt-no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{data.shopName}</p>
          <p className="text-sm text-muted">Payment receipt</p>
        </div>
        <DownloadReceiptPdfButton
          token={data.token}
          fileName={`${data.referenceNumber}.pdf`}
        />
      </div>

      <article
        id="receipt-document"
        className="receipt-sheet rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:shadow-none"
      >
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {data.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logoUrl}
                alt={`${data.shopName} logo`}
                className="h-16 w-16 object-contain sm:h-20 sm:w-20"
              />
            ) : null}
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                {data.shopName}
              </h1>
              {data.addressLines.length > 0 ? (
                <div className="mt-1 space-y-0.5 text-sm text-neutral-600">
                  {data.addressLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}
              {data.contactLines.length > 0 ? (
                <div className="mt-2 space-y-0.5 text-sm text-neutral-600">
                  {data.contactLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-800 sm:pt-1">
            {data.receiptTitle || "PAYMENT RECEIPT"}
          </p>
        </header>

        <section className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-neutral-500">Receipt No</dt>
            <dd className="font-medium text-neutral-900">
              {data.referenceNumber}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block sm:text-right">
            <dt className="text-neutral-500">Date</dt>
            <dd className="font-medium text-neutral-900">
              {formatReceiptDate(data.createdAt)}
            </dd>
          </div>
        </section>

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {pending ? "Invoice To" : "Received From"}
          </p>
          <p className="mt-2 text-lg font-semibold text-neutral-900">
            {data.customerName?.trim() || "Customer"}
          </p>
          {data.customerPhone ? (
            <p className="mt-1 text-sm text-neutral-600">{data.customerPhone}</p>
          ) : null}
          {data.invoiceId ? (
            <p className="mt-1 text-sm text-neutral-600">
              Invoice: {data.invoiceId}
            </p>
          ) : null}
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-neutral-200">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-start gap-4 px-4 py-4 text-sm">
            <p className="whitespace-pre-wrap text-neutral-800">{description}</p>
            <p className="whitespace-nowrap font-semibold text-neutral-900">
              {amount}
            </p>
          </div>
        </section>

        <section className="mt-6 space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-neutral-500">Payment Status</span>
            <span
              className={`font-semibold ${
                pending ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {pending ? "Pending" : "Paid"}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-100 pt-2">
            <span className="text-neutral-500">
              {pending ? "Amount Due" : "Amount Received"}
            </span>
            <span className="text-base font-semibold text-neutral-900">
              {amount}
            </span>
          </div>
        </section>

        {data.slipUrl ? (
          <section className="mt-8 receipt-no-print">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Attached bank slip
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.slipUrl}
              alt="Payment slip"
              className="mt-3 max-h-72 w-full rounded-xl border border-neutral-200 object-contain"
            />
          </section>
        ) : null}

        {pending && data.pendingPay ? (
          <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/60 p-4 receipt-no-print">
            <h2 className="font-semibold text-neutral-900">Pay now</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Scan the QR or transfer using the bank details below. Use the
              receipt number as the reference.
            </p>
            {data.pendingPay.qrDataUrl ? (
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.pendingPay.qrDataUrl}
                  alt="Payment QR"
                  className="h-48 w-48"
                />
              </div>
            ) : null}
            <dl className="mt-4 space-y-2 text-sm">
              {data.pendingPay.bankName ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Bank</dt>
                  <dd>{data.pendingPay.bankName}</dd>
                </div>
              ) : null}
              {data.pendingPay.branch ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Branch</dt>
                  <dd>{data.pendingPay.branch}</dd>
                </div>
              ) : null}
              {data.pendingPay.accountName ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Account name</dt>
                  <dd className="text-right">{data.pendingPay.accountName}</dd>
                </div>
              ) : null}
              {data.pendingPay.accountNumber ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Account no.</dt>
                  <dd>{data.pendingPay.accountNumber}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Reference</dt>
                <dd>{data.referenceNumber}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <footer className="mt-10 border-t border-neutral-200 pt-6">
          <p className="text-sm text-neutral-700">
            {data.receiptFooter || "Thank you for your payment."}
          </p>
          {data.authorizedBy ? (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Authorized By
              </p>
              <p className="mt-2 font-medium text-neutral-900">
                {data.authorizedBy}
              </p>
            </div>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
