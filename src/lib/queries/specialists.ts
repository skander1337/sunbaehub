import { and, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { priceFor, priceForDuration, priceNote, type PriceBreakdown } from "@/lib/rules/pricing";
import { isRanked } from "@/lib/rules/ranking";
import type { Locale } from "@/lib/i18n/dictionary";
import { discoverSpecialists, type DiscoveryAvailability, type SpecialistDiscoveryOptions } from "@/lib/rules/discovery";
import { fromSeoul, seoulParts } from "@/lib/seoul";

export type { SpecialistDiscoveryOptions } from "@/lib/rules/discovery";

export type SpecialistCardData = {
  id: string;
  name: string;
  headline: string;
  categories: string[];
  basePrice: number;
  reviewCount: number;
  avgScore: number;
  rankScore: number;
  verification: string;
  ranked: boolean;
  pricing: PriceBreakdown;
  price30: number;
  note: Record<Locale, string>;
};

export type AvailableSpecialistCardData = SpecialistCardData & DiscoveryAvailability;

const toCard = (u: { id: string; name: string }, p: typeof schema.specialistProfiles.$inferSelect): SpecialistCardData => {
  const pricing = priceFor(p.basePrice, p.reviewCount, p.avgScore);
  return {
    id: u.id,
    name: u.name,
    headline: p.headline,
    categories: p.categories,
    basePrice: p.basePrice,
    reviewCount: p.reviewCount,
    avgScore: p.avgScore,
    rankScore: p.rankScore,
    verification: p.verification,
    ranked: isRanked(p.reviewCount),
    pricing,
    price30: priceForDuration(pricing.price, 30),
    note: { ko: priceNote(pricing, "ko"), en: priceNote(pricing, "en") },
  };
};

export function listSpecialists(opts: { category?: string } = {}): SpecialistCardData[] {
  const rows = db
    .select({ u: schema.users, p: schema.specialistProfiles })
    .from(schema.specialistProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.specialistProfiles.userId))
    .where(and(isNotNull(schema.specialistProfiles.resumePath), eq(schema.specialistProfiles.verification, "verified")))
    .orderBy(desc(schema.specialistProfiles.rankScore), desc(schema.specialistProfiles.reviewCount))
    .all();
  return rows
    .map((r) => toCard(r.u, r.p))
    .filter((c) => !opts.category || c.categories.includes(opts.category));
}

/** Directory-only availability discovery; landing and leaderboard keep their existing ranking. */
export function listAvailableSpecialists(options: SpecialistDiscoveryOptions): AvailableSpecialistCardData[] {
  const candidates = listSpecialists({ category: options.category }).filter((card) => card.id !== options.userId);
  if (!candidates.length) return [];
  const ids = candidates.map((card) => card.id);
  const p = seoulParts(options.now);
  const horizonEnd = fromSeoul(p.y, p.m, p.d + 14);
  const rules = db.select().from(schema.availabilityRules).where(inArray(schema.availabilityRules.specialistId, ids)).all();
  const busy = db
    .select({ specialistId: schema.bookings.specialistId, startAt: schema.bookings.startAt, endAt: schema.bookings.endAt })
    .from(schema.bookings)
    .where(and(
      inArray(schema.bookings.specialistId, ids),
      inArray(schema.bookings.status, ["confirmed", "in_progress"]),
      gte(schema.bookings.endAt, options.now),
      lt(schema.bookings.startAt, horizonEnd),
    ))
    .all();
  return discoverSpecialists(candidates, rules, busy, options);
}

export function getSpecialistCard(id: string): SpecialistCardData | null {
  const row = db
    .select({ u: schema.users, p: schema.specialistProfiles })
    .from(schema.specialistProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.specialistProfiles.userId))
    .where(eq(schema.specialistProfiles.userId, id))
    .get();
  return row ? toCard(row.u, row.p) : null;
}

/** Weekly rules and future busy ranges for slot computation. */
export function getAvailabilityInputs(specialistId: string, from: Date) {
  const rules = db.select().from(schema.availabilityRules).where(eq(schema.availabilityRules.specialistId, specialistId)).all();
  const busy = db
    .select({ startAt: schema.bookings.startAt, endAt: schema.bookings.endAt })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.specialistId, specialistId), inArray(schema.bookings.status, ["confirmed", "in_progress"])))
    .all()
    .filter((b) => b.endAt.getTime() >= from.getTime() - 86_400_000);
  return { rules, busy };
}
