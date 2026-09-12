import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SpecialistProfile, User } from "@/db/schema";
import { currentSessionToken, findUserByToken } from "@/lib/session";

export async function currentUser(): Promise<User | null> {
  const token = await currentSessionToken();
  if (!token) return null;
  return findUserByToken(token, new Date());
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
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
