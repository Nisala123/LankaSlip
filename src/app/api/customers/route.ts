import { NextResponse } from "next/server";
import { requireVendorApi } from "@/server/auth/session";
import { listRecentCustomers } from "@/server/domain/receipts";
import { maskPhone } from "@/server/domain/phones";

export async function GET() {
  const session = await requireVendorApi();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const rows = await listRecentCustomers(session.user.tenantId);
  return NextResponse.json({
    customers: rows.map((row) => ({
      id: row.id,
      phone: row.phoneE164,
      displayPhone: maskPhone(row.phoneE164),
      name: row.name,
    })),
  });
}
