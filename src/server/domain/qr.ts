import QRCode from "qrcode";
import { formatLkr } from "@/server/domain/money";

export async function paymentQrDataUrl(input: {
  lankaQrPayload?: string | null;
  shopName: string;
  amountCents: number;
  referenceNumber: string;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branch?: string | null;
}) {
  const payload =
    input.lankaQrPayload?.trim() ||
    [
      `Pay ${input.shopName}`,
      `LKR ${formatLkr(input.amountCents)}`,
      `Ref ${input.referenceNumber}`,
      input.bankName,
      input.branch,
      input.accountName,
      input.accountNumber,
    ]
      .filter(Boolean)
      .join("\n");

  return QRCode.toDataURL(payload, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
}
