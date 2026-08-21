import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireVendorApi } from "@/server/auth/session";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { writeAudit } from "@/server/domain/audit";
import { storeLogo } from "@/server/storage/logos";

export async function POST(request: Request) {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a logo image" }, { status: 400 });
  }

  try {
    const stored = await storeLogo(file);
    await db
      .update(vendorProfiles)
      .set({ logoKey: stored.key, updatedAt: new Date() })
      .where(eq(vendorProfiles.tenantId, session.user.tenantId));
    await writeAudit({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "profile.logo_updated",
      entityType: "vendor_profile",
    });
    return NextResponse.json({ ok: true, logoKey: stored.key });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not upload logo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  await db
    .update(vendorProfiles)
    .set({ logoKey: null, updatedAt: new Date() })
    .where(eq(vendorProfiles.tenantId, session.user.tenantId));
  return NextResponse.json({ ok: true });
}
