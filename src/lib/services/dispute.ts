import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { bookings, disputes, notifications, reviews } from "@/db/schema";
import { refundSplit } from "@/lib/rules/refund";
import { getPlatformUserId, postTx } from "./ledger";
import { settleBooking } from "./settlement";

export class DisputeRuleError extends Error {
  constructor(public code: "not_seeker" | "not_disputable" | "already_reviewed" | "not_open") {
    super(code);
  }
}

export function openDispute(tx: Tx | Db, input: { bookingId: string; seekerId: string; reason: string }, now: Date): string {
  const b = tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
  if (!b || b.seekerId !== input.seekerId) throw new DisputeRuleError("not_seeker");
  if (b.status !== "completed" || b.settledAt) throw new DisputeRuleError("not_disputable");
  const reviewed = tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, b.id)).get();
  if (reviewed) throw new DisputeRuleError("already_reviewed");
  const id = crypto.randomUUID();
  tx.insert(disputes).values({ id, bookingId: b.id, openedById: input.seekerId, reason: input.reason.trim(), status: "open", createdAt: now }).run();
  tx.update(bookings).set({ status: "disputed" }).where(eq(bookings.id, b.id)).run();
  tx.insert(notifications).values({ userId: b.specialistId, kind: "dispute_update", params: { status: "open" }, href: "/specialist/dashboard", createdAt: now }).run();
  return id;
}

export function resolveDispute(tx: Tx | Db, disputeId: string, decision: "approved" | "rejected", adminNote: string, now: Date): void {
  const d = tx.select().from(disputes).where(eq(disputes.id, disputeId)).get();
  if (!d || d.status !== "open") throw new DisputeRuleError("not_open");
  const b = tx.select().from(bookings).where(eq(bookings.id, d.bookingId)).get();
  if (!b) throw new DisputeRuleError("not_open");
  if (decision === "approved") {
    const split = refundSplit(b.price);
    postTx(tx, { userId: b.seekerId, type: "booking_refund", amount: split.seekerRefund, bookingId: b.id, note: "환불 승인 (50%, 수수료 제외)", createdAt: now });
    postTx(tx, { userId: b.specialistId, type: "booking_release", amount: split.specialistPayout, bookingId: b.id, note: "환불 후 부분 정산", createdAt: now });
    postTx(tx, { userId: getPlatformUserId(tx), type: "platform_fee", amount: split.platformFee, bookingId: b.id, note: "플랫폼 수수료 5%", createdAt: now });
    tx.update(bookings).set({ status: "refunded", settledAt: now }).where(eq(bookings.id, b.id)).run();
  } else {
    tx.update(bookings).set({ status: "completed" }).where(eq(bookings.id, b.id)).run();
    settleBooking(tx, { id: b.id, price: b.price, specialistId: b.specialistId, settledAt: b.settledAt }, now);
  }
  tx.update(disputes).set({ status: decision, adminNote: adminNote.trim() || null, resolvedAt: now }).where(eq(disputes.id, d.id)).run();
  tx.insert(notifications).values({ userId: b.seekerId, kind: "dispute_update", params: { status: decision }, href: "/me/bookings", createdAt: now }).run();
  tx.insert(notifications).values({ userId: b.specialistId, kind: "dispute_update", params: { status: decision }, href: "/specialist/dashboard", createdAt: now }).run();
}
