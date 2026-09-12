import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { priceFor, priceNote, type PriceBreakdown } from "@/lib/rules/pricing";
import { isRanked } from "@/lib/rules/ranking";
import type { Locale } from "@/lib/i18n/dictionary";

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
  note: Record<Locale, string>;
};

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
    note: { ko: priceNote(pricing, "ko"), en: priceNote(pricing, "en") },
  };
};

export function listSpecialists(opts: { category?: string; verifiedOnly?: boolean } = {}): SpecialistCardData[] {
  const rows = db
    .select({ u: schema.users, p: schema.specialistProfiles })
    .from(schema.specialistProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.specialistProfiles.userId))
    .where(opts.verifiedOnly ? eq(schema.specialistProfiles.verification, "verified") : undefined)
    .orderBy(desc(schema.specialistProfiles.rankScore), desc(schema.specialistProfiles.reviewCount))
    .all();
  return rows
    .map((r) => toCard(r.u, r.p))
    .filter((c) => !opts.category || c.categories.includes(opts.category));
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
