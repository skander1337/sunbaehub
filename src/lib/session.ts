import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, gt, lt, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Db, Tx } from "@/db";
import type { User } from "@/db/schema";

export const SESSION_COOKIE = "sunbae_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session row and returns the raw token for the cookie. */
export function createSession(tx: Tx | Db, userId: string, now: Date): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  tx.insert(schema.sessions).values({ id: hashToken(token), userId, createdAt: now, expiresAt }).run();
  // opportunistic cleanup of expired sessions
  tx.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).run();
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentSessionToken(): Promise<string | null> {
  const v = (await cookies()).get(SESSION_COOKIE)?.value;
  return v && v.length > 0 ? v : null;
}

export function findUserByToken(token: string, now: Date): User | null {
  const row = db
    .select({ u: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, now)))
    .get();
  return row?.u ?? null;
}

export function deleteSessionByToken(token: string): void {
  db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
}
