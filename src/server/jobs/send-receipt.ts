import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { customers, messages, receipts, vendorProfiles } from "@/server/db/schema";
import { getDispatchChannel } from "@/server/channels/router";
import { receiptPublicUrl } from "@/server/channels/urls";
import { writeAudit } from "@/server/domain/audit";
import { maskPhone } from "@/server/domain/phones";
import { readObjectBuffer } from "@/server/storage/slips";

export async function sendReceiptJob(messageId: string) {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    throw new Error("Message not found");
  }
  if (message.status === "delivered" || message.status === "read") {
    return;
  }

  const [receipt] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, message.receiptId))
    .limit(1);
  if (!receipt) {
    throw new Error("Receipt not found");
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, receipt.customerId))
    .limit(1);
  const [profile] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, receipt.tenantId))
    .limit(1);

  if (!customer || !profile) {
    throw new Error("Receipt is missing customer or shop profile");
  }

  await db
    .update(messages)
    .set({
      attemptCount: message.attemptCount + 1,
      lastAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(messages.id, message.id));

  const channel = getDispatchChannel();
  let media: { bytes: Buffer; contentType: string; filename: string } | undefined;
  if (receipt.slipObjectKey) {
    const bytes = await readObjectBuffer(receipt.slipObjectKey);
    if (bytes) {
      media = {
        bytes,
        contentType: "image/jpeg",
        filename: "slip.jpg",
      };
    }
  }

  try {
    const result = await channel.send({
      toE164: customer.phoneE164,
      receiptToken: receipt.token,
      receiptUrl: receiptPublicUrl(receipt.token),
      amountCents: receipt.amountCents,
      currency: "LKR",
      invoiceId: receipt.invoiceId ?? receipt.referenceNumber,
      paymentStatus: receipt.paymentStatus as "received" | "pending",
      shopName: profile.shopName,
      media,
    });

    await db
      .update(messages)
      .set({
        status: "sent",
        channel: channel.id,
        providerMessageId: result.providerMessageId,
        templateName: result.templateName,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, message.id));

    await writeAudit({
      tenantId: receipt.tenantId,
      userId: receipt.createdByUserId,
      action: "message.sent",
      entityType: "message",
      entityId: message.id,
      metadata: {
        channel: channel.id,
        templateName: result.templateName,
        to: maskPhone(customer.phoneE164),
      },
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "Send failed";
    await db
      .update(messages)
      .set({
        status: "failed",
        error: text,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, message.id));
    throw error;
  }
}
