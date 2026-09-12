export type FraudRule =
  | "reciprocal_7d"
  | "booking_ring_14d"
  | "repeat_reviewer_30d"
  | "burst_high_24h"
  | "new_account"
  | "instant_empty";

export const FRAUD_RULE_LABELS: Record<FraudRule, { ko: string; en: string }> = {
  reciprocal_7d: { ko: "상호 리뷰 (7일 이내)", en: "Reciprocal review within 7 days" },
  booking_ring_14d: { ko: "상호 예약 (14일 이내)", en: "Mutual bookings within 14 days" },
  repeat_reviewer_30d: { ko: "동일 이용자 반복 리뷰 (30일 내 3회)", en: "Same reviewer 3+ times in 30 days" },
  burst_high_24h: { ko: "24시간 내 95점 이상 리뷰 4건", en: "4+ reviews of 95+ within 24 hours" },
  new_account: { ko: "신규 계정 (3일 미만, 활동 없음)", en: "New account under 3 days with no activity" },
  instant_empty: { ko: "세션 직후 즉시 리뷰 (대화 없음)", en: "Review seconds after session with no chat" },
};

export type FraudReview = { id: string; bookingId: string; reviewerId: string; specialistId: string; score: number; createdAt: Date };
export type FraudBooking = { id: string; seekerId: string; specialistId: string; startAt: Date; status: string; completedAt: Date | null; messageCount: number };
export type FraudReviewer = { id: string; createdAt: Date; bookingCount: number; hasTopup: boolean };

export type FraudContext = {
  review: FraudReview;
  booking: FraudBooking;
  reviewer: FraudReviewer;
  /** Reviews written by this review's specialist about the reviewer's own specialist profile (non-hidden). */
  reverseReviews: FraudReview[];
  /** Non-cancelled bookings where the specialist booked the reviewer (roles swapped). */
  reverseBookings: FraudBooking[];
  /** Non-hidden reviews by the same reviewer for the same specialist (including this one). */
  sameReviewerReviews: FraudReview[];
  /** Non-hidden reviews for the same specialist from anyone (including this one). */
  specialistReviews: FraudReview[];
};

export type FraudHit = { rule: FraudRule; detail: Record<string, unknown> };

const DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / DAY;

export function evaluateReview(ctx: FraudContext): FraudHit[] {
  const hits: FraudHit[] = [];
  const { review, booking, reviewer } = ctx;

  const reciprocal = ctx.reverseReviews.find((r) => r.id !== review.id && daysBetween(r.createdAt, review.createdAt) <= 7);
  if (reciprocal) {
    hits.push({ rule: "reciprocal_7d", detail: { otherReviewId: reciprocal.id, days: Math.round(daysBetween(reciprocal.createdAt, review.createdAt)) } });
  }

  const ring = ctx.reverseBookings.find((b) => b.status !== "cancelled" && daysBetween(b.startAt, booking.startAt) <= 14);
  if (ring) {
    hits.push({ rule: "booking_ring_14d", detail: { otherBookingId: ring.id, days: Math.round(daysBetween(ring.startAt, booking.startAt)) } });
  }

  // trailing 30-day window ending at this review
  const repeats = ctx.sameReviewerReviews.filter(
    (r) => r.createdAt.getTime() <= review.createdAt.getTime() && review.createdAt.getTime() - r.createdAt.getTime() <= 30 * DAY,
  );
  if (repeats.length >= 3) {
    hits.push({ rule: "repeat_reviewer_30d", detail: { count: repeats.length } });
  }

  if (review.score >= 95) {
    const high = ctx.specialistReviews.filter((r) => r.score >= 95).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // any 24h window that contains this review and at least 4 high scores
    let best = 0;
    for (const start of high) {
      const windowEnd = start.createdAt.getTime() + DAY;
      const inWindow = high.filter((r) => r.createdAt.getTime() >= start.createdAt.getTime() && r.createdAt.getTime() <= windowEnd);
      if (inWindow.some((r) => r.id === review.id)) best = Math.max(best, inWindow.length);
    }
    if (best >= 4) hits.push({ rule: "burst_high_24h", detail: { count: best } });
  }

  const accountAgeDays = (review.createdAt.getTime() - reviewer.createdAt.getTime()) / DAY;
  if (accountAgeDays < 3 && reviewer.bookingCount <= 1 && !reviewer.hasTopup) {
    hits.push({ rule: "new_account", detail: { accountAgeDays: Math.round(accountAgeDays * 10) / 10, bookings: reviewer.bookingCount } });
  }

  if (booking.completedAt) {
    const secondsAfter = (review.createdAt.getTime() - booking.completedAt.getTime()) / 1000;
    if (secondsAfter >= 0 && secondsAfter < 60 && booking.messageCount < 2) {
      hits.push({ rule: "instant_empty", detail: { secondsAfter: Math.round(secondsAfter), messages: booking.messageCount } });
    }
  }

  return hits;
}
