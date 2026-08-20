import { toProviderPhone } from "@/server/domain/phones";
import { buildReceiptSmsBody } from "./urls";
import type { DispatchChannel, DispatchCommand, DispatchResult } from "./types";

const SEND_URL = "https://app.notify.lk/api/v1/send";

function explainNotifyError(payload: unknown, fallback: string) {
  const body = payload as {
    status?: string;
    data?: string | { message?: string };
    message?: string;
  };
  if (typeof body?.data === "string" && body.data) return body.data;
  if (typeof body?.data === "object" && body.data?.message) {
    return body.data.message;
  }
  if (body?.message) return body.message;
  return fallback;
}

export class NotifyLkChannel implements DispatchChannel {
  readonly id = "sms" as const;

  async send(cmd: DispatchCommand): Promise<DispatchResult> {
    const userId = process.env.NOTIFY_LK_USER_ID;
    const apiKey = process.env.NOTIFY_LK_API_KEY;
    const senderId = process.env.NOTIFY_LK_SENDER_ID || "NotifyDEMO";

    if (!userId || !apiKey) {
      throw new Error("Notify.lk is not configured (NOTIFY_LK_USER_ID / NOTIFY_LK_API_KEY)");
    }

    const message = buildReceiptSmsBody({
      shopName: cmd.shopName,
      amountCents: cmd.amountCents,
      paymentStatus: cmd.paymentStatus,
      invoiceId: cmd.invoiceId,
      receiptUrl: cmd.receiptUrl,
    });

    const form = new URLSearchParams({
      user_id: userId,
      api_key: apiKey,
      sender_id: senderId,
      to: toProviderPhone(cmd.toE164),
      message,
    });

    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });

    const json = (await res.json().catch(() => null)) as {
      status?: string;
      data?: string;
    } | null;

    if (!res.ok || !json || json.status !== "success") {
      throw new Error(
        explainNotifyError(json, "Notify.lk could not send the SMS"),
      );
    }

    return {
      providerMessageId: `notify_${Date.now()}`,
      templateName: "sms_receipt",
      raw: json,
    };
  }
}
