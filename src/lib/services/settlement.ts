import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { bookings, disputes, notifications } from "@/db/schema";
import { normalSettlement } from "@/lib/rules/refund";
import { GRACE_MIN } from "@/lib/rules/session";
import { postTx, getPlatformUserId } from "./ledger";

const HOUR = 3_600_000;

/** confirmed / in_progress bookings whose window has closed become completed, and the seeker is asked to review. */
export function transitionEndedBookings(tx: Tx | Db, now: Date): number {
  const cutoff = new Date(now.getTime() - GRACE_MIN * 60_000);
  const due = tx
    .select()
    .from(bookings)
    .where(and(inArray(bookings.status, ["confirmed", "in_progress"]), lt(bookings.endAt, cutoff)))
    .all();
  for (const b of due) {
    tx.update(bookings).set({ status: "completed", completedAt: b.endAt }).where(eq(bookings.id, b.id)).run();
    tx.insert(notifications)
      .values({ userId: b.seekerId, kind: "review_request", params: {}, href: `/bookings/${b.id}/review`, createdAt: b.endAt })
      .run();
  }
  return due.length;
}

/** Releases escrow to the specialist and posts the platform fee. Idempotent per booking. */
export function settleBooking(tx: Tx | Db, booking: { id: string; price: number; specialistId: string; settledAt: Date | null }, at: Date): boolean {
  if (booking.settledAt) return false;
  const { platformFee, specialistPayout } = normalSettlement(booking.price);
  postTx(tx, { userId: booking.specialistId, type: "booking_release", amount: specialistPayout, bookingId: booking.id, note: "상담 완료 정산", createdAt: at });
  postTx(tx, { userId: getPlatformUserId(tx), type: "platform_fee", amount: platformFee, bookingId: booking.id, note: "플랫폼 수수료 5%", createdAt: at });
  tx.update(bookings).set({ settledAt: at }).where(eq(bookings.id, booking.id)).run();
  return true;
}

/** Completed, unsettled, undisputed bookings older than 24h settle automatically. Returns how many settled. */
export function settleDueBookings(tx: Tx | Db, now: Date): number {
  transitionEndedBookings(tx, now);
  const cutoff = new Date(now.getTime() - 24 * HOUR);
  const due = tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "completed"), isNull(bookings.settledAt), lt(bookings.completedAt, cutoff)))
    .all();
  let n = 0;
  for (const b of due) {
    const open = tx.select({ id: disputes.id }).from(disputes).where(eq(disputes.bookingId, b.id)).get();
    if (open) continue;
    if (settleBooking(tx, b, now)) n++;
  }
  return n;
}
