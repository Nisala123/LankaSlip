import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

loadEnvConfig(process.cwd());

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  poolUrl?: string;
};

/** Neon + node-pg: prefer libpq-compatible SSL; drop channel_binding which breaks some clients. */
export function normalizeDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("channel_binding");
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    if (!parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function getPool() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  const connectionString = normalizeDatabaseUrl(raw);

  if (!globalForDb.pool || globalForDb.poolUrl !== connectionString) {
    if (globalForDb.pool) {
      void globalForDb.pool.end().catch(() => undefined);
    }
    globalForDb.pool = new Pool({
      connectionString,
      max: process.env.VERCEL === "1" ? 1 : 10,
    });
    globalForDb.poolUrl = connectionString;
  }
  return globalForDb.pool;
}

export const db = drizzle(getPool(), { schema });
export { schema };
