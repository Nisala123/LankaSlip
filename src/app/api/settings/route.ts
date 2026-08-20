import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVendorApi } from "@/server/auth/session";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { writeAudit } from "@/server/domain/audit";

const schema = z.object({
  shopName: z.string().min(2).max(80),
  bankName: z.string().max(80).optional(),
  accountName: z.string().max(80).optional(),
  accountNumber: z.string().max(40).optional(),
  branch: z.string().max(80).optional(),
  lankaQrPayload: z.string().max(2000).optional(),
});

export async function GET() {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const [profile] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, session.user.tenantId))
    .limit(1);
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check shop details and try again" }, { status: 400 });
  }
  await db
    .update(vendorProfiles)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(vendorProfiles.tenantId, session.user.tenantId));
  await writeAudit({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "profile.updated",
    entityType: "vendor_profile",
  });
  return NextResponse.json({ ok: true });
}
