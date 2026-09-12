export const RANK_C = 5; // phantom reviews
export const RANK_M = 75; // phantom mean
export const MIN_REVIEWS_FOR_RANK = 3;

/** Bayesian average: (C·m + n·avg) / (C + n). Five phantom reviews at 75 keep one lucky 100 off the top. */
export function rankScore(avgScore: number, reviewCount: number, C = RANK_C, m = RANK_M): number {
  if (reviewCount <= 0) return 0;
  return Math.round(((C * m + reviewCount * avgScore) / (C + reviewCount)) * 100) / 100;
}

export function isRanked(reviewCount: number): boolean {
  return reviewCount >= MIN_REVIEWS_FOR_RANK;
}
