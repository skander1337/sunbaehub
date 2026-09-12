/** Small in-memory sliding-window limiter, per process. Enough for a single-node deployment. */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const since = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= limit) {
    return { ok: false, retryAfterMs: hits[0] + windowMs - now };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.every((t) => t <= since)) buckets.delete(k);
  }
  return { ok: true, retryAfterMs: 0 };
}
