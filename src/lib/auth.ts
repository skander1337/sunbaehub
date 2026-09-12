import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SpecialistProfile, User } from "@/db/schema";

export const UID_COOKIE = "sunbae_uid";

export async function currentUserId(): Promise<string | null> {
  const v = (await cookies()).get(UID_COOKIE)?.value;
  return v && v.length > 0 ? v : null;
}

export async function currentUser(): Promise<User | null> {
  const id = await currentUserId();
  if (!id) return null;
  const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  return user ?? null;
}

export async function requireUser(next?: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export async function requireSpecialist(): Promise<{ user: User; profile: SpecialistProfile }> {
  const user = await requireUser();
  const profile = db.select().from(schema.specialistProfiles).where(eq(schema.specialistProfiles.userId, user.id)).get();
  if (!user.isSpecialist || !profile) redirect("/me/bookings");
  return { user, profile };
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
