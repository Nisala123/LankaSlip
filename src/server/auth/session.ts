import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/server/auth";

export async function getVendorSession(): Promise<{
  user: SessionUser;
} | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  const user = session.user as SessionUser;
  if (!user.tenantId) return null;
  return { user };
}

export async function requireVendor() {
  const session = await getVendorSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireVendorApi() {
  const session = await getVendorSession();
  if (!session) {
    return null;
  }
  return session;
}
