import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { notifications, specialistProfiles, withdrawalRequests } from "@/db/schema";
import { postTx } from "./ledger";

export function requestVerification(tx: Tx | Db, userId: string, now: Date): void {
  const p = tx.select().from(specialistProfiles).where(eq(specialistProfiles.userId, userId)).get();
  if (!p || !p.resumePath || p.verification === "verified" || p.verification === "pending") return;
  tx.update(specialistProfiles).set({ verification: "pending" }).where(eq(specialistProfiles.userId, userId)).run();
  void now;
}

export function reviewVerification(tx: Tx | Db, userId: string, decision: "verified" | "rejected", now: Date): void {
  tx.update(specialistProfiles).set({ verification: decision }).where(eq(specialistProfiles.userId, userId)).run();
  tx.insert(notifications).values({ userId, kind: "verification", params: { status: decision }, href: "/specialist/dashboard", createdAt: now }).run();
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
