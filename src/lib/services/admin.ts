import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { notifications, specialistProfiles, withdrawalRequests, type SpecialistProfile } from "@/db/schema";
import { postTx } from "./ledger";
import { clampBaseRate } from "@/lib/rules/pricing";

export function isProfileComplete(p: Pick<SpecialistProfile, "headline" | "bio" | "categories" | "education" | "experience" | "resumePath">): boolean {
  return p.headline.trim().length >= 2 && p.bio.trim().length >= 10 && p.categories.length > 0 && p.education.length > 0 && p.experience.length > 0 && !!p.resumePath;
}

/** Moves a complete, unreviewed (or rejected) profile into the admin review queue. Returns false when incomplete. */
export function submitForReview(tx: Tx | Db, userId: string, now: Date): boolean {
  const p = tx.select().from(specialistProfiles).where(eq(specialistProfiles.userId, userId)).get();
  if (!p || p.verification === "verified" || p.verification === "pending") return p?.verification === "pending";
  if (!isProfileComplete(p)) return false;
  tx.update(specialistProfiles).set({ verification: "pending", submittedAt: now, verificationNote: null }).where(eq(specialistProfiles.userId, userId)).run();
  return true;
}

export function reviewVerification(tx: Tx | Db, userId: string, decision: "verified" | "rejected", note: string, now: Date, baseRate?: number | null): void {
  const trimmed = note.trim().slice(0, 500);
  const current = tx.select({ requestedRate: specialistProfiles.requestedRate }).from(specialistProfiles).where(eq(specialistProfiles.userId, userId)).get();
  const patch: Partial<typeof specialistProfiles.$inferInsert> = { verification: decision, verificationNote: decision === "rejected" && trimmed ? trimmed : null };
  if (decision === "verified") patch.basePrice = clampBaseRate(baseRate ?? current?.requestedRate ?? 100);
  tx.update(specialistProfiles).set(patch).where(eq(specialistProfiles.userId, userId)).run();
  tx.insert(notifications)
    .values({ userId, kind: "verification", params: decision === "rejected" && trimmed ? { status: "rejected_note", note: trimmed } : { status: decision }, href: "/specialist/dashboard", createdAt: now })
    .run();
}

export function resolveWithdrawal(tx: Tx | Db, id: string, decision: "paid" | "rejected", now: Date): void {
  const w = tx.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id)).get();
  if (!w || w.status !== "pending") return;
  tx.update(withdrawalRequests).set({ status: decision }).where(eq(withdrawalRequests.id, id)).run();
  if (decision === "rejected") {
    postTx(tx, { userId: w.userId, type: "withdrawal", amount: w.amount, note: "출금 반려 (환원)", createdAt: now });
  }
  tx.insert(notifications).values({ userId: w.userId, kind: "payout", params: { status: decision, amount: w.amount }, href: "/specialist/earnings", createdAt: now }).run();
}

/** Admin sets a specialist's base rate (credits per 60 minutes). The pricing formula applies on top. */
export function setBaseRate(tx: Tx | Db, userId: string, rate: number, now: Date): number {
  const basePrice = clampBaseRate(rate);
  tx.update(specialistProfiles).set({ basePrice }).where(eq(specialistProfiles.userId, userId)).run();
  tx.insert(notifications).values({ userId, kind: "rate_update", params: { rate: basePrice }, href: "/specialist/dashboard", createdAt: now }).run();
  return basePrice;
}
