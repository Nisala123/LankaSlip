import { eq } from "drizzle-orm";
import { requireVendor } from "@/server/auth/session";
import { db } from "@/server/db";
import { vendorProfiles } from "@/server/db/schema";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const { user } = await requireVendor();
  const [profile] = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.tenantId, user.tenantId))
    .limit(1);

  return (
    <SettingsForm
      initial={{
        shopName: profile?.shopName ?? "",
        bankName: profile?.bankName ?? "",
        accountName: profile?.accountName ?? "",
        accountNumber: profile?.accountNumber ?? "",
        branch: profile?.branch ?? "",
        lankaQrPayload: profile?.lankaQrPayload ?? "",
      }}
    />
  );
}
