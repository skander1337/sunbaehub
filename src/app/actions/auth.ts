"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { postTx } from "@/lib/services/ledger";
import { clearSessionCookie, createSession, currentSessionToken, deleteSessionByToken, setSessionCookie } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { BRAND } from "@/lib/brand";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
// A real hash so unknown emails cost the same time as wrong passwords (no user enumeration by timing).
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local").split(",")[0].trim();
}

function safeNext(next: string): string | null {
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
}

function homeFor(user: { isAdmin: boolean; isSpecialist: boolean }, next: string) {
  return safeNext(next) ?? (user.isAdmin ? "/admin" : user.isSpecialist ? "/specialist/dashboard" : "/specialists");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, PASSWORD_MAX);
  const next = String(formData.get("next") ?? "");
  const back = (code: string) => `/login?${safeNext(next) ? `next=${encodeURIComponent(next)}&` : ""}error=${code}`;

  const ip = await clientKey();
  if (!rateLimit(`login:ip:${ip}`, 30, 15 * 60_000).ok || !rateLimit(`login:email:${email}`, 10, 15 * 60_000).ok) redirect(back("rate_limited"));

  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  const ok = user && !user.isPlatform ? verifyPassword(password, user.passwordHash) : (verifyPassword(password, DUMMY_HASH), false);
  if (!ok || !user) redirect(back("credentials"));

  const now = new Date();
  const { token, expiresAt } = db.transaction((tx) => createSession(tx, user.id, now));
  await setSessionCookie(token, expiresAt);
  redirect(homeFor(user, next));
}

export async function signup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "seeker") === "expert" ? "expert" : "seeker";
  const back = (code: string) => `/signup?role=${role}&error=${code}`;

  const ip = await clientKey();
  if (!rateLimit(`signup:ip:${ip}`, 10, 60 * 60_000).ok) redirect(back("rate_limited"));
  if (name.length < 1) redirect(back("invalid"));
  if (!EMAIL.test(email)) redirect(back("email_invalid"));
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) redirect(back("password_short"));

  const affiliation = role === "seeker" ? String(formData.get("affiliation") ?? "").trim().slice(0, 80) || null : null;

  const id = crypto.randomUUID();
  const now = new Date();
  let token = "";
  let expiresAt = now;
  try {
    db.transaction((tx) => {
      tx.insert(schema.users).values({ id, name, email, passwordHash: hashPassword(password), isSpecialist: role === "expert", affiliation, createdAt: now }).run();
      if (role === "seeker") postTx(tx, { userId: id, type: "signup_grant", amount: BRAND.seekerSignupGrant, note: `가입 축하 크레딧 (${BRAND.trialMinutes}분 상담 1회)`, createdAt: now });
      if (role === "expert") {
        tx.insert(schema.specialistProfiles).values({ userId: id, headline: "", bio: "", categories: [], basePrice: 100, education: [], experience: [], verification: "none" }).run();
      }
      ({ token, expiresAt } = createSession(tx, id, now));
    });
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed: users\.email/.test(e.message)) redirect(back("email_taken"));
    throw e;
  }
  await setSessionCookie(token, expiresAt);
  redirect(role === "expert" ? "/specialist/onboarding" : "/specialists");
}

export async function logout() {
  const token = await currentSessionToken();
  if (token) deleteSessionByToken(token);
  await clearSessionCookie();
  redirect("/");
}
