import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

const COOKIE_NAME = "lc_session";

export async function getOrCreateSessionId(): Promise<string> {
  const c = await cookies();
  const existing = c.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const sid = cryptoRandomId();
  c.set(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return sid;
}

export async function getSessionIdMaybe(): Promise<string | undefined> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value;
}

export function cryptoRandomId(): string {
  // 16-byte random hex id
  return randomBytes(16).toString("hex");
}
