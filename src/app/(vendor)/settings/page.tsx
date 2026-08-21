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
      hasLogo={Boolean(profile?.logoKey)}
      initial={{
        shopName: profile?.shopName ?? "",
        addressLine1: profile?.addressLine1 ?? "",
        addressLine2: profile?.addressLine2 ?? "",
        city: profile?.city ?? "",
        contactPhone: profile?.contactPhone ?? "",
        contactEmail: profile?.contactEmail ?? "",
        website: profile?.website ?? "",
        receiptTitle: profile?.receiptTitle ?? "PAYMENT RECEIPT",
        receiptFooter:
          profile?.receiptFooter ?? "Thank you for your payment.",
        authorizedBy: profile?.authorizedBy ?? "",
        bankName: profile?.bankName ?? "",
        accountName: profile?.accountName ?? "",
        accountNumber: profile?.accountNumber ?? "",
        branch: profile?.branch ?? "",
        lankaQrPayload: profile?.lankaQrPayload ?? "",
      }}
    />
  );
}
