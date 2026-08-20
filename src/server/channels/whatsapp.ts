import { formatLkr } from "@/server/domain/money";
import { toProviderPhone } from "@/server/domain/phones";
import type { DispatchChannel, DispatchCommand, DispatchResult } from "./types";
export { receiptPublicUrl } from "./urls";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function explainWhatsAppError(payload: unknown): string {
  const err = payload as {
    error?: { message?: string; error_user_msg?: string; code?: number };
  };
  if (err?.error?.error_user_msg) return err.error.error_user_msg;
  if (err?.error?.message) return err.error.message;
  return "WhatsApp could not send the message";
}

async function uploadMedia(bytes: Buffer, contentType: string, filename: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error("WhatsApp is not configured");
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", contentType);
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    filename,
  );

  const res = await fetch(`${GRAPH}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as { id?: string };
  if (!res.ok || !json.id) {
    throw new Error(explainWhatsAppError(json));
  }
  return json.id;
}

export class WhatsAppCloudChannel implements DispatchChannel {
  readonly id = "whatsapp" as const;

  async send(cmd: DispatchCommand): Promise<DispatchResult> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    if (!phoneNumberId || !token) {
      throw new Error("WhatsApp is not configured");
    }

    const useMedia = Boolean(cmd.media);
    const templateName =
      cmd.paymentStatus === "pending"
        ? useMedia
          ? process.env.WHATSAPP_TEMPLATE_PENDING_MEDIA ||
            process.env.WHATSAPP_TEMPLATE_PENDING ||
            "lankaslip_pending"
          : process.env.WHATSAPP_TEMPLATE_PENDING || "lankaslip_pending"
        : useMedia
          ? process.env.WHATSAPP_TEMPLATE_PAID_MEDIA ||
            process.env.WHATSAPP_TEMPLATE_PAID ||
            "lankaslip_paid"
          : process.env.WHATSAPP_TEMPLATE_PAID || "lankaslip_paid";

    const components: Array<Record<string, unknown>> = [];

    if (useMedia && cmd.media) {
      const mediaId = await uploadMedia(
        cmd.media.bytes,
        cmd.media.contentType,
        cmd.media.filename,
      );
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { id: mediaId } }],
      });
    }

    components.push({
      type: "body",
      parameters: [
        { type: "text", text: cmd.shopName },
        { type: "text", text: formatLkr(cmd.amountCents) },
        { type: "text", text: cmd.invoiceId },
      ],
    });

    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: cmd.receiptToken }],
    });

    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toProviderPhone(cmd.toE164),
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components,
        },
      }),
    });

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
    };
    if (!res.ok || !json.messages?.[0]?.id) {
      throw new Error(explainWhatsAppError(json));
    }

    return {
      providerMessageId: json.messages[0].id,
      templateName,
      raw: json,
    };
  }
}
