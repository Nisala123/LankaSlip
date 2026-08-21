import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVendorApi } from "@/server/auth/session";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { writeAudit } from "@/server/domain/audit";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });

const schema = z.object({
  shopName: z.string().min(2).max(80),
  addressLine1: optionalText(120),
  addressLine2: optionalText(120),
  city: optionalText(80),
  contactPhone: optionalText(40),
  contactEmail: optionalText(120),
  website: optionalText(120),
  receiptTitle: optionalText(80),
  receiptFooter: optionalText(300),
  authorizedBy: optionalText(120),
  bankName: optionalText(80),
  accountName: optionalText(80),
  accountNumber: optionalText(40),
  branch: optionalText(80),
  lankaQrPayload: optionalText(2000),
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
    return NextResponse.json(
      { error: "Check shop details and try again" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  await db
    .update(vendorProfiles)
    .set({
      shopName: data.shopName,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      website: data.website,
      receiptTitle: data.receiptTitle ?? "PAYMENT RECEIPT",
      receiptFooter: data.receiptFooter ?? "Thank you for your payment.",
      authorizedBy: data.authorizedBy,
      bankName: data.bankName,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      branch: data.branch,
      lankaQrPayload: data.lankaQrPayload,
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
