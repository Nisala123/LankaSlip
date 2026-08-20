import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "better-auth/crypto";
import { db } from "./index";
import { account, tenants, user, vendorProfiles } from "./schema";

loadEnvConfig(process.cwd());

async function seed() {
  const email = process.env.SEED_OWNER_EMAIL ?? "owner@lankaslip.local";
  const password = process.env.SEED_OWNER_PASSWORD ?? "changeme-now";
  const shopName = process.env.SEED_SHOP_NAME ?? "LankaSlip Demo Shop";

  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) {
    const passwordHash = await hashPassword(password);
    const [credentialAccount] = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, existing.id),
          eq(account.providerId, "credential"),
        ),
      )
      .limit(1);

    if (credentialAccount) {
      await db
        .update(account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(account.id, credentialAccount.id));
    } else {
      await db.insert(account).values({
        id: nanoid(),
        accountId: existing.id,
        providerId: "credential",
        userId: existing.id,
        password: passwordHash,
      });
    }

    console.info(`Updated seeded owner ${email}`);
    return;
  }

  const tenantId = nanoid();
  const userId = nanoid();
  const now = new Date();

  await db.insert(tenants).values({
    id: tenantId,
    name: shopName,
    timezone: "Asia/Colombo",
    defaultChannel: "whatsapp",
  });

  await db.insert(vendorProfiles).values({
    id: nanoid(),
    tenantId,
    shopName,
    bankName: "Commercial Bank",
    accountName: shopName,
    accountNumber: "0000000000",
    branch: "Colombo",
  });

  await db.insert(user).values({
    id: userId,
    name: "Shop Owner",
    email,
    emailVerified: true,
    tenantId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(account).values({
    id: nanoid(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });

  console.info(`Seeded tenant "${shopName}" and owner ${email}`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
