"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { UID_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { CATEGORIES } from "@/lib/categories";
import { postTx } from "@/lib/services/ledger";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function setSession(userId: string) {
  (await cookies()).set(UID_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

function homeFor(user: { isAdmin: boolean; isSpecialist: boolean }, next: string) {
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  if (user.isAdmin) return "/admin";
  if (user.isSpecialist) return "/specialist/dashboard";
  return "/specialists";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const back = `/login${next ? `?next=${encodeURIComponent(next)}&` : "?"}error=credentials`;
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user || user.isPlatform || !verifyPassword(password, user.passwordHash)) redirect(back);
  await setSession(user.id);
  redirect(homeFor(user, next));
}

export async function signup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "seeker") === "expert" ? "expert" : "seeker";
  const back = (code: string) => `/signup?role=${role}&error=${code}`;
  if (name.length < 1) redirect(back("invalid"));
  if (!EMAIL.test(email)) redirect(back("email_invalid"));
  if (password.length < 8) redirect(back("password_short"));
  if (db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get()) redirect(back("email_taken"));

  let headline = "";
  let categories: string[] = [];
  let basePrice = 100;
  if (role === "expert") {
    headline = String(formData.get("headline") ?? "").trim().slice(0, 80);
    categories = CATEGORIES.map((c) => c.id).filter((id) => formData.getAll("categories").includes(id));
    basePrice = Math.round(Number(formData.get("basePrice")));
    if (headline.length < 2 || categories.length === 0 || !Number.isFinite(basePrice) || basePrice < 10 || basePrice > 1000) redirect(back("invalid"));
  }

  const id = crypto.randomUUID();
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(schema.users).values({ id, name, email, passwordHash: hashPassword(password), isSpecialist: role === "expert", createdAt: now }).run();
    postTx(tx, { userId: id, type: "signup_grant", amount: 200, note: "가입 축하 크레딧", createdAt: now });
    if (role === "expert") {
      tx.insert(schema.specialistProfiles).values({ userId: id, headline, bio: "", categories, basePrice, education: [], experience: [], verification: "none" }).run();
    }
  });
  await setSession(id);
  redirect(role === "expert" ? "/specialist/profile?welcome=1" : "/specialists");
}

export async function logout() {
  (await cookies()).delete(UID_COOKIE);
  redirect("/");
}
