import { maskPhone } from "@/server/domain/phones";
import type { DispatchChannel, DispatchCommand, DispatchResult } from "./types";

export class StubChannel implements DispatchChannel {
  readonly id = "stub" as const;

  async send(cmd: DispatchCommand): Promise<DispatchResult> {
    console.info("[stub-channel] would send receipt", {
      to: maskPhone(cmd.toE164),
      receiptUrl: cmd.receiptUrl,
      amountCents: cmd.amountCents,
      paymentStatus: cmd.paymentStatus,
      shopName: cmd.shopName,
      hasMedia: Boolean(cmd.media),
    });
    return {
      providerMessageId: `stub_${Date.now()}`,
      templateName: cmd.paymentStatus === "pending" ? "stub_pending" : "stub_paid",
    };
  }
}
