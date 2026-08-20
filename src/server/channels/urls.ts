import { appUrl } from "@/lib/env";
import { formatLkr } from "@/server/domain/money";
import { toProviderPhone } from "@/server/domain/phones";
import type { PaymentStatus } from "./types";

export function receiptPublicUrl(token: string) {
  return `${appUrl()}/r/${token}`;
}

export function buildReceiptSmsBody(input: {
  shopName: string;
  amountCents: number;
  paymentStatus: PaymentStatus;
  invoiceId: string;
  receiptUrl: string;
}) {
  const amount = formatLkr(input.amountCents);
  const status =
    input.paymentStatus === "pending" ? "pending" : "confirmed";
  const verb =
    input.paymentStatus === "pending" ? "Pay / view" : "View";
  const body = `${input.shopName}: LKR ${amount} ${status} (${input.invoiceId}). ${verb}: ${input.receiptUrl}`;
  return body.slice(0, 621);
}

export function buildWhatsAppShareUrl(input: {
  toE164: string;
  shopName: string;
  amountCents: number;
  paymentStatus: PaymentStatus;
  invoiceId: string;
  receiptUrl: string;
}) {
  const text = buildReceiptSmsBody(input);
  const phone = toProviderPhone(input.toE164);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
