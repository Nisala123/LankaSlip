import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { appUrl, authTrustedOrigins } from "@/lib/env";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: appUrl(),
  trustedOrigins: authTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    additionalFields: {
      tenantId: {
        type: "string",
        required: true,
        input: false,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "cashier",
        input: false,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [nextCookies()],
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  role: "owner" | "cashier" | string;
};
