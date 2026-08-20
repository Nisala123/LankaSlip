import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireVendor } from "@/server/auth/session";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { SignOutButton } from "@/components/sign-out-button";

export default async function VendorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireVendor();
  const [profile] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, user.tenantId))
    .limit(1);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-10 pt-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            LankaSlip
          </p>
          <h1 className="text-lg font-semibold leading-tight">
            {profile?.shopName ?? "Your shop"}
          </h1>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-accent">
            New
          </Link>
          <Link href="/settings" className="text-muted hover:text-foreground">
            Settings
          </Link>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
