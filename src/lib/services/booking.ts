import { and, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { availabilityRules, bookings, notifications, specialistProfiles, users, type Booking } from "@/db/schema";
import { priceFor, priceForDuration, priceNote } from "@/lib/rules/pricing";
import { BRAND } from "@/lib/brand";
import { OTHER_CONSULTATION_PURPOSE } from "@/lib/categories";
import { computeSlots, slotExists } from "@/lib/rules/slots";
import { cancellationQuote } from "@/lib/rules/refund";
import { isParticipant, sessionWindow } from "@/lib/rules/session";
import { assertBalance, getPlatformUserId, postTx } from "./ledger";

export class SlotUnavailable extends Error {
  constructor() {
    super("slot unavailable");
  }
}
export class BookingRuleError extends Error {
  constructor(public code: "not_participant" | "not_cancellable" | "refund_quote_changed" | "not_endable" | "own_profile" | "not_verified" | "other_purpose_required" | "note_length") {
    super(code);
  }
}

export function loadAvailability(tx: Tx | Db, specialistId: string, now: Date) {
  const rules = tx.select().from(availabilityRules).where(eq(availabilityRules.specialistId, specialistId)).all();
  const busy = tx
    .select({ startAt: bookings.startAt, endAt: bookings.endAt })
    .from(bookings)
    .where(and(eq(bookings.specialistId, specialistId), inArray(bookings.status, ["confirmed", "in_progress"])))
    .all()
    .filter((b) => b.endAt.getTime() >= now.getTime() - 86_400_000);
  return { rules, busy };
}

export function createBooking(
  tx: Tx | Db,
  input: { seekerId: string; specialistId: string; startAt: Date; category: string; note?: string; durationMin?: number },
  now: Date,
): Booking {
  const note = input.note?.trim() ?? "";
  if (input.category === OTHER_CONSULTATION_PURPOSE.id && !note) throw new BookingRuleError("other_purpose_required");
  if (note.length > 500) throw new BookingRuleError("note_length");
  const durationMin = (BRAND.durations as readonly number[]).includes(input.durationMin ?? 60) ? (input.durationMin ?? 60) : 60;
  if (input.seekerId === input.specialistId) throw new BookingRuleError("own_profile");
  const profile = tx.select().from(specialistProfiles).where(eq(specialistProfiles.userId, input.specialistId)).get();
  if (!profile) throw new SlotUnavailable();
  if (profile.verification !== "verified") throw new BookingRuleError("not_verified");
  const { rules, busy } = loadAvailability(tx, input.specialistId, now);
  const days = computeSlots(rules, busy, now, { slotMin: durationMin, stepMin: BRAND.slotStepMinutes });
  if (!slotExists(days, input.startAt)) throw new SlotUnavailable();

  const pricing = priceFor(profile.basePrice, profile.reviewCount, profile.avgScore);
  const price = priceForDuration(pricing.price, durationMin);
  assertBalance(tx, input.seekerId, price);

  const id = crypto.randomUUID();
  const endAt = new Date(input.startAt.getTime() + durationMin * 60_000);
  tx.insert(bookings)
    .values({
      id,
      seekerId: input.seekerId,
      specialistId: input.specialistId,
      category: input.category,
      startAt: input.startAt,
      endAt,
      durationMin,
      price,
      priceNote: priceNote(pricing, "ko"),
      status: "confirmed",
      seekerNote: note || null,
      createdAt: now,
    })
    .run();
  const specialist = tx.select({ name: users.name }).from(users).where(eq(users.id, input.specialistId)).get();
  const seeker = tx.select({ name: users.name }).from(users).where(eq(users.id, input.seekerId)).get();
  postTx(tx, { userId: input.seekerId, type: "booking_hold", amount: -price, bookingId: id, note: `${specialist?.name ?? ""} ${durationMin}분 상담 예약`, createdAt: now });
  tx.insert(notifications).values({ userId: input.seekerId, kind: "booking_created", params: { name: specialist?.name ?? "" }, href: "/me/bookings", createdAt: now }).run();
  tx.insert(notifications).values({ userId: input.specialistId, kind: "booking_created", params: { name: seeker?.name ?? "" }, href: "/specialist/dashboard", createdAt: now }).run();
  return tx.select().from(bookings).where(eq(bookings.id, id)).get()!;
}

export function cancelBooking(tx: Tx | Db, bookingId: string, byUserId: string, now: Date, expectedRefund: number): "full_refund" | "split" {
  const b = tx.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!b || !isParticipant(b, byUserId)) throw new BookingRuleError("not_participant");
  if (b.status !== "confirmed" || b.startAt.getTime() <= now.getTime()) throw new BookingRuleError("not_cancellable");
  const by = byUserId === b.specialistId ? "specialist" : "seeker";
  const quote = cancellationQuote(b.price, b.startAt, now, by);
  // A page can stay open across the 24-hour cutoff. Never pay a different
  // refund than the participant confirmed; show a fresh quote first.
  if (!Number.isSafeInteger(expectedRefund) || expectedRefund !== quote.seekerRefund) throw new BookingRuleError("refund_quote_changed");
  const { outcome } = quote;
  if (outcome === "full_refund") {
    postTx(tx, { userId: b.seekerId, type: "booking_refund", amount: quote.seekerRefund, bookingId: b.id, note: "예약 취소 환불", createdAt: now });
  } else {
    postTx(tx, { userId: b.seekerId, type: "booking_refund", amount: quote.seekerRefund, bookingId: b.id, note: "예약 취소 환불 (50%, 수수료 제외)", createdAt: now });
    postTx(tx, { userId: b.specialistId, type: "booking_release", amount: quote.specialistPayout, bookingId: b.id, note: "당일 취소 보상", createdAt: now });
    postTx(tx, { userId: getPlatformUserId(tx), type: "platform_fee", amount: quote.platformFee, bookingId: b.id, note: "플랫폼 수수료 5%", createdAt: now });
  }
  tx.update(bookings).set({ status: "cancelled", settledAt: now }).where(eq(bookings.id, b.id)).run();
  const other = by === "seeker" ? b.specialistId : b.seekerId;
  tx.insert(notifications).values({ userId: other, kind: "booking_cancelled", params: { outcome }, href: by === "seeker" ? "/specialist/dashboard" : "/me/bookings", createdAt: now }).run();
  return outcome;
}

/** First activity inside the window flips confirmed → in_progress. */
export function touchSession(tx: Tx | Db, b: Booking, now: Date): Booking {
  if (b.status === "confirmed" && sessionWindow(b, now) === "open") {
    tx.update(bookings).set({ status: "in_progress" }).where(eq(bookings.id, b.id)).run();
    return { ...b, status: "in_progress" };
  }
  return b;
}

export function endSession(tx: Tx | Db, bookingId: string, byUserId: string, now: Date): Booking {
  const b = tx.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!b || !isParticipant(b, byUserId)) throw new BookingRuleError("not_participant");
  if (!(b.status === "confirmed" || b.status === "in_progress") || sessionWindow(b, now) !== "open") throw new BookingRuleError("not_endable");
  tx.update(bookings).set({ status: "completed", completedAt: now, endAt: now }).where(eq(bookings.id, b.id)).run();
  tx.insert(notifications).values({ userId: b.seekerId, kind: "review_request", params: {}, href: `/bookings/${b.id}/review`, createdAt: now }).run();
  return { ...b, status: "completed", completedAt: now, endAt: now };
}

/** Dev/demo helper: move a confirmed booking so its window opens now, or ends now. */
export function devShiftBooking(tx: Tx | Db, bookingId: string, mode: "start_now" | "end_now", now: Date): void {
  const b = tx.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!b) return;
  const durationMs = b.durationMin * 60_000;
  if (mode === "start_now" && b.status === "confirmed") {
    const startAt = new Date(now.getTime() - 60_000);
    tx.update(bookings).set({ startAt, endAt: new Date(startAt.getTime() + durationMs) }).where(eq(bookings.id, b.id)).run();
  }
  if (mode === "end_now" && (b.status === "confirmed" || b.status === "in_progress")) {
    const endAt = new Date(now.getTime() - 6 * 60_000);
    tx.update(bookings).set({ startAt: new Date(endAt.getTime() - durationMs), endAt }).where(eq(bookings.id, b.id)).run();
  }
}
