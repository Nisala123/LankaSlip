export type PaymentStatus = "received" | "pending";
export type ChannelId = "whatsapp" | "sms" | "stub";
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type DispatchCommand = {
  toE164: string;
  receiptToken: string;
  receiptUrl: string;
  amountCents: number;
  currency: "LKR";
  invoiceId: string;
  paymentStatus: PaymentStatus;
  shopName: string;
  media?: {
    bytes: Buffer;
    contentType: string;
    filename: string;
  };
};

export type DispatchResult = {
  providerMessageId?: string;
  templateName?: string;
  raw?: unknown;
};

export interface DispatchChannel {
  readonly id: ChannelId;
  send(cmd: DispatchCommand): Promise<DispatchResult>;
}
