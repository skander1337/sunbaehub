import { and, eq, ne, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { bookings, creditTransactions, messages, reviewFlags, reviews, specialistProfiles, users } from "@/db/schema";
import { evaluateReview, type FraudContext, type FraudHit } from "@/lib/rules/fraud";
import { rankScore } from "@/lib/rules/ranking";

/** Rewrites the cached reviewCount / avgScore / rankScore from VISIBLE reviews only. */
export function recomputeStats(tx: Tx | Db, specialistId: string): void {
  const row = tx
    .select({ n: sql<number>`count(*)`, avg: sql<number>`coalesce(avg(${reviews.score}), 0)` })
    .from(reviews)
    .where(and(eq(reviews.specialistId, specialistId), eq(reviews.status, "visible")))
    .get();
  const n = Number(row?.n ?? 0);
  const avg = Number(row?.avg ?? 0);
  tx.update(specialistProfiles)
    .set({ reviewCount: n, avgScore: Math.round(avg * 10) / 10, rankScore: rankScore(avg, n) })
    .where(eq(specialistProfiles.userId, specialistId))
    .run();
}

const toFraudReview = (r: typeof reviews.$inferSelect) => ({
  id: r.id,
  bookingId: r.bookingId,
  reviewerId: r.reviewerId,
  specialistId: r.specialistId,
  score: r.score,
  createdAt: r.createdAt,
});

export function buildFraudContext(tx: Tx | Db, reviewId: string): FraudContext | null {
  const review = tx.select().from(reviews).where(eq(reviews.id, reviewId)).get();
  if (!review) return null;
  const booking = tx.select().from(bookings).where(eq(bookings.id, review.bookingId)).get();
  const reviewer = tx.select().from(users).where(eq(users.id, review.reviewerId)).get();
  if (!booking || !reviewer) return null;

  const messageCount = Number(
    tx.select({ n: sql<number>`count(*)` }).from(messages).where(eq(messages.bookingId, booking.id)).get()?.n ?? 0,
  );
  const bookingCount = Number(
    tx.select({ n: sql<number>`count(*)` }).from(bookings).where(eq(bookings.seekerId, reviewer.id)).get()?.n ?? 0,
  );
  const topups = Number(
    tx
      .select({ n: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, reviewer.id), eq(creditTransactions.type, "topup")))
      .get()?.n ?? 0,
  );

  const reverseReviews = tx
    .select()
    .from(reviews)
    .where(and(eq(reviews.reviewerId, review.specialistId), eq(reviews.specialistId, review.reviewerId), ne(reviews.status, "hidden")))
    .all();
  const reverseBookings = tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.seekerId, review.specialistId), eq(bookings.specialistId, review.reviewerId), ne(bookings.status, "cancelled")))
    .all();
  const sameReviewerReviews = tx
    .select()
    .from(reviews)
    .where(and(eq(reviews.reviewerId, review.reviewerId), eq(reviews.specialistId, review.specialistId), ne(reviews.status, "hidden")))
    .all();
  const specialistReviews = tx
    .select()
    .from(reviews)
    .where(and(eq(reviews.specialistId, review.specialistId), ne(reviews.status, "hidden")))
    .all();

  return {
    review: toFraudReview(review),
    booking: {
      id: booking.id,
      seekerId: booking.seekerId,
      specialistId: booking.specialistId,
      startAt: booking.startAt,
      status: booking.status,
      completedAt: booking.completedAt,
      messageCount,
    },
    reviewer: { id: reviewer.id, createdAt: reviewer.createdAt, bookingCount, hasTopup: topups > 0 },
    reverseReviews: reverseReviews.map(toFraudReview),
    reverseBookings: reverseBookings.map((b) => ({
      id: b.id,
      seekerId: b.seekerId,
      specialistId: b.specialistId,
      startAt: b.startAt,
      status: b.status,
      completedAt: b.completedAt,
      messageCount: 0,
    })),
    sameReviewerReviews: sameReviewerReviews.map(toFraudReview),
    specialistReviews: specialistReviews.map(toFraudReview),
  };
}

/**
 * Evaluates one review, inserts any new flags (idempotent per rule), and marks the review flagged
 * only when a NEW flag row was created, so dismissed flags never re-flag a review.
 * A burst hit re-evaluates the other high-score reviews in the window (one level deep).
 */
export function evaluateAndFlag(tx: Tx | Db, reviewId: string, cascade = true): FraudHit[] {
  const ctx = buildFraudContext(tx, reviewId);
  if (!ctx) return [];
  const hits = evaluateReview(ctx);
  let inserted = 0;
  for (const h of hits) {
    const res = tx.insert(reviewFlags).values({ reviewId, rule: h.rule, detail: h.detail }).onConflictDoNothing().run();
    inserted += Number(res.changes ?? 0);
  }
  if (inserted > 0) {
    tx.update(reviews).set({ status: "flagged" }).where(and(eq(reviews.id, reviewId), eq(reviews.status, "visible"))).run();
  }
  if (cascade && hits.some((h) => h.rule === "burst_high_24h")) {
    const DAY = 86_400_000;
    for (const r of ctx.specialistReviews) {
      if (r.id !== reviewId && r.score >= 95 && Math.abs(r.createdAt.getTime() - ctx.review.createdAt.getTime()) <= DAY) {
        evaluateAndFlag(tx, r.id, false);
      }
    }
  }
  return hits;
}

/** Admin "전체 스캔": re-evaluates every non-hidden review. Returns the number of reviews newly flagged. */
export function runFraudScan(tx: Tx | Db): { evaluated: number; flagged: number } {
  const rows = tx.select({ id: reviews.id, status: reviews.status }).from(reviews).where(ne(reviews.status, "hidden")).all();
  let flagged = 0;
  for (const r of rows) {
    evaluateAndFlag(tx, r.id, false);
    const after = tx.select({ status: reviews.status }).from(reviews).where(eq(reviews.id, r.id)).get();
    if (r.status === "visible" && after?.status === "flagged") flagged++;
  }
  const specialists = tx.select({ id: specialistProfiles.userId }).from(specialistProfiles).all();
  for (const s of specialists) recomputeStats(tx, s.id);
  return { evaluated: rows.length, flagged };
}
