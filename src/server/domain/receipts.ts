import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  customers,
  messages,
  receipts,
  vendorProfiles,
} from "@/server/db/schema";
import { writeAudit } from "@/server/domain/audit";
import { lkrToCents } from "@/server/domain/money";
import { hashPhone, normalizeLkPhone } from "@/server/domain/phones";
import {
  buildReference,
  colomboDateStamp,
  newId,
  newReceiptToken,
} from "@/server/domain/references";
import { enqueueSendReceipt } from "@/server/jobs/boss";
import { dispatchChannel } from "@/lib/env";

export const createReceiptSchema = z.object({
  phone: z.string().min(9).max(20),
  amount: z.string().min(1).max(16),
  itemDetails: z.string().max(500).optional(),
  invoiceId: z.string().max(80).optional(),
  paymentStatus: z.enum(["received", "pending"]),
  slipObjectKey: z.string().max(200).optional(),
  customerName: z.string().max(80).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

const RECEIPT_TTL_DAYS = 90;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export async function createReceipt(opts: {
  tenantId: string;
  userId: string;
  input: CreateReceiptInput;
  idempotencyKey?: string | null;
}) {
  const phoneE164 = normalizeLkPhone(opts.input.phone);
  const amountCents = lkrToCents(opts.input.amount);
  const idempotencyKey = opts.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existing = await loadByIdempotency(opts.tenantId, idempotencyKey);
    if (existing) return { ...existing, replayed: true as const };
  }

  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, opts.tenantId),
        eq(customers.phoneE164, phoneE164),
      ),
    )
    .limit(1);

  const customer =
    existingCustomer ??
    (
      await db
        .insert(customers)
        .values({
          id: newId(),
          tenantId: opts.tenantId,
          phoneE164,
          name: opts.input.customerName,
        })
        .onConflictDoNothing()
        .returning()
    )[0] ??
    (
      await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, opts.tenantId),
            eq(customers.phoneE164, phoneE164),
          ),
        )
        .limit(1)
    )[0];

  if (!customer) {
    throw new Error("Could not save customer");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RECEIPT_TTL_DAYS);

  let receiptRow;
  let messageRow;
  try {
      const result = await db.transaction(async (tx) => {
        const stamp = colomboDateStamp();
        const prefix = `LS-${stamp}-`;
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(receipts)
          .where(
            and(
              eq(receipts.tenantId, opts.tenantId),
              gte(receipts.referenceNumber, prefix),
            ),
          );
        const referenceNumber = buildReference(Number(count) + 1);
      const [receipt] = await tx
        .insert(receipts)
        .values({
          id: newId(),
          tenantId: opts.tenantId,
          customerId: customer.id,
          createdByUserId: opts.userId,
          referenceNumber,
          token: newReceiptToken(),
          amountCents,
          currency: "LKR",
          invoiceId: opts.input.invoiceId,
          itemDetails: opts.input.itemDetails,
          paymentStatus: opts.input.paymentStatus,
          slipObjectKey: opts.input.slipObjectKey,
          idempotencyKey,
          expiresAt,
        })
        .returning();

      const [message] = await tx
        .insert(messages)
        .values({
          id: newId(),
          tenantId: opts.tenantId,
          receiptId: receipt.id,
          channel: dispatchChannel(),
          status: "queued",
        })
        .returning();

      return { receipt, message };
    });
    receiptRow = result.receipt;
    messageRow = result.message;
  } catch (error) {
    if (idempotencyKey && isUniqueViolation(error)) {
      const existing = await loadByIdempotency(opts.tenantId, idempotencyKey);
      if (existing) return { ...existing, replayed: true as const };
    }
    throw error;
  }

  await enqueueSendReceipt(messageRow.id);
  await writeAudit({
    tenantId: opts.tenantId,
    userId: opts.userId,
    action: "receipt.created",
    entityType: "receipt",
    entityId: receiptRow.id,
    phoneHash: hashPhone(phoneE164),
    metadata: {
      referenceNumber: receiptRow.referenceNumber,
      paymentStatus: receiptRow.paymentStatus,
    },
  });

  return {
    receipt: receiptRow,
    message: messageRow,
    customer,
    replayed: false as const,
  };
}

export async function loadByIdempotency(tenantId: string, key: string) {
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(
      and(eq(receipts.tenantId, tenantId), eq(receipts.idempotencyKey, key)),
    )
    .limit(1);
  if (!receipt) return null;
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.receiptId, receipt.id))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, receipt.customerId))
    .limit(1);
  if (!message || !customer) return null;
  return { receipt, message, customer };
}

export async function getReceiptForVendor(tenantId: string, receiptId: string) {
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)))
    .limit(1);
  if (!receipt) return null;
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.receiptId, receipt.id))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, receipt.customerId))
    .limit(1);
  return { receipt, message, customer };
}

export async function listRecentReceipts(tenantId: string, limit = 20) {
  const rows = await db
    .select({
      receipt: receipts,
      customer: customers,
    })
    .from(receipts)
    .innerJoin(customers, eq(customers.id, receipts.customerId))
    .where(eq(receipts.tenantId, tenantId))
    .orderBy(desc(receipts.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const latestMessages = await db
    .select()
    .from(messages)
    .where(
      inArray(
        messages.receiptId,
        rows.map((row) => row.receipt.id),
      ),
    )
    .orderBy(desc(messages.createdAt));

  const messageByReceipt = new Map<string, (typeof latestMessages)[number]>();
  for (const message of latestMessages) {
    if (!messageByReceipt.has(message.receiptId)) {
      messageByReceipt.set(message.receiptId, message);
    }
  }

  return rows.map((row) => ({
    ...row,
    message: messageByReceipt.get(row.receipt.id) ?? null,
  }));
}

export async function listRecentCustomers(tenantId: string, limit = 8) {
  return db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .orderBy(desc(customers.createdAt))
    .limit(limit);
}

export async function getPublicReceipt(token: string) {
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.token, token))
    .limit(1);
  if (!receipt) return null;
  if (receipt.expiresAt && receipt.expiresAt < new Date()) return null;

  const [profile] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, receipt.tenantId))
    .limit(1);
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, receipt.customerId))
    .limit(1);

  return { receipt, profile, customer };
}

export async function retryMessage(tenantId: string, receiptId: string) {
  const loaded = await getReceiptForVendor(tenantId, receiptId);
  if (!loaded?.message) return null;

  const [queued] = await db
    .insert(messages)
    .values({
      id: newId(),
      tenantId,
      receiptId,
      channel: loaded.message.channel,
      status: "queued",
    })
    .returning();

  await enqueueSendReceipt(queued.id);
  return queued;
}

export async function applyProviderStatus(input: {
  providerMessageId: string;
  status: string;
  error?: string;
}) {
  const mapped =
    input.status === "sent" ||
    input.status === "delivered" ||
    input.status === "read" ||
    input.status === "failed"
      ? input.status
      : null;
  if (!mapped) return;

  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.providerMessageId, input.providerMessageId))
    .limit(1);
  if (!message) return;

  await db
    .update(messages)
    .set({
      status: mapped,
      error: mapped === "failed" ? input.error ?? "Delivery failed" : null,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, message.id));
}
