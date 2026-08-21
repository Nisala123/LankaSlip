import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { requireVendorApi } from "@/server/auth/session";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { getSignedReadUrl, streamLocalObject } from "@/server/storage";

export async function GET() {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const [profile] = await db
    .select({ logoKey: vendorProfiles.logoKey })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, session.user.tenantId))
    .limit(1);
  if (!profile?.logoKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signed = await getSignedReadUrl(profile.logoKey);
  if (signed) {
    return NextResponse.redirect(signed, 302);
  }

  const stream = streamLocalObject(profile.logoKey);
  if (!stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}
