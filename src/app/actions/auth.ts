"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { UID_COOKIE } from "@/lib/auth";

export async function login(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const next = String(formData.get("next") ?? "");
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user || user.isPlatform) redirect("/login");
  (await cookies()).set(UID_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  if (next.startsWith("/")) redirect(next);
  if (user.isAdmin) redirect("/admin");
  if (user.isSpecialist) redirect("/specialist/dashboard");
  redirect("/specialists");
}

export async function logout() {
  (await cookies()).delete(UID_COOKIE);
  redirect("/");
}
