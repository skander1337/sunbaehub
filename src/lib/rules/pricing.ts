export const PRICE_CAP = 1.5;
/** Platform floor for a 60-minute session, in credits. Admin-set base rates and computed prices never go below it. */
export const MIN_BASE_RATE = 50;
export const MAX_BASE_RATE = 1000;

export type PriceBreakdown = {
  base: number;
  price: number;
  multiplier: number;
  countBonus: number;
  scoreBonus: number;
  reviewCount: number;
  avgScore: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const roundTo5 = (v: number) => Math.round(v / 5) * 5;

/**
 * Dynamic 60-minute price: the admin-set base rate × (1 + count bonus + score bonus). Count bonus is +1% per review up to
 * +20%; score bonus is up to +35% at an average of 100, nothing below 65, and only once there are 3+ visible reviews.
 * Capped at 1.5× base and never below MIN_BASE_RATE.
 * Example: base 100, 12 reviews, avg 88 → 1 + 0.12 + 0.35 × (23/35) = 1.35 → 135 credits.
 */
export function priceFor(base: number, reviewCount: number, avgScore: number): PriceBreakdown {
  const countBonus = round2(0.01 * Math.min(reviewCount, 20));
  const scoreBonus = reviewCount >= 3 ? round2(0.35 * clamp((avgScore - 65) / 35, 0, 1)) : 0;
  const multiplier = Math.min(round2(1 + countBonus + scoreBonus), PRICE_CAP);
  const price = Math.max(MIN_BASE_RATE, roundTo5(base * multiplier));
  return { base, price, multiplier, countBonus, scoreBonus, reviewCount, avgScore };
}

export function priceNote(b: PriceBreakdown, locale: "ko" | "en"): string {
  const avg = Math.round(b.avgScore);
  if (locale === "ko") {
    if (b.multiplier === 1) return b.reviewCount > 0 ? `기본가 · 리뷰 ${b.reviewCount}개` : "기본가 · 아직 리뷰 없음";
    return `기본가의 ${b.multiplier.toFixed(2)}배 · 리뷰 ${b.reviewCount}개 · 평균 ${avg}점`;
  }
  if (b.multiplier === 1) return b.reviewCount > 0 ? `Base rate · ${b.reviewCount} reviews` : "Base rate · no reviews yet";
  return `${b.multiplier.toFixed(2)}× base · ${b.reviewCount} reviews · avg ${avg}`;
}

/** Price for a session of `minutes` length, proportional to the 60-minute price and rounded to 5. */
export function priceForDuration(sixtyMinutePrice: number, minutes: number): number {
  return Math.max(5, roundTo5((sixtyMinutePrice * minutes) / 60));
}

export function clampBaseRate(n: number): number {
  if (!Number.isFinite(n)) return MIN_BASE_RATE;
  return Math.min(MAX_BASE_RATE, Math.max(MIN_BASE_RATE, Math.round(n / 5) * 5));
}
