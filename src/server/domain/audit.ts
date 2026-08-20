import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { newId } from "@/server/domain/references";

export async function writeAudit(input: {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  phoneHash?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    id: newId(),
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    phoneHash: input.phoneHash,
    metadata: input.metadata,
  });
}
