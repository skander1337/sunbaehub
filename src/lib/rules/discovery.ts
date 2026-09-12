import { BRAND } from "@/lib/brand";
import { priceForDuration } from "@/lib/rules/pricing";
import { computeSlots, type BusyRange, type SlotRule } from "@/lib/rules/slots";
import { seoulDayKey } from "@/lib/seoul";

export type SpecialistDiscoveryOptions = {
  category?: string;
  durationMin: 30 | 60;
  availableToday?: boolean;
  affordableOnly?: boolean;
  balance: number | null;
  sort?: "recommended" | "soonest";
  userId?: string;
  now: Date;
};

type DiscoveryCandidate = { id: string; categories: string[]; pricing: { price: number } };
export type DiscoveryAvailability = { nextAvailableAt: Date | null; selectedPrice: number };
type SpecialistRule = SlotRule & { specialistId: string };
type SpecialistBusyRange = BusyRange & { specialistId: string };

function groupBySpecialist<T extends { specialistId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.specialistId);
    if (group) group.push(row);
    else grouped.set(row.specialistId, [row]);
  }
  return grouped;
}

/** Reuse the booking slot engine so discovery prices and availability match checkout. */
export function discoverSpecialists<T extends DiscoveryCandidate>(
  candidates: T[],
  rules: SpecialistRule[],
  busy: SpecialistBusyRange[],
  options: SpecialistDiscoveryOptions,
): Array<T & DiscoveryAvailability> {
  const rulesBySpecialist = groupBySpecialist(rules);
  const busyBySpecialist = groupBySpecialist(busy);
  const today = seoulDayKey(options.now);
  const results = candidates
    .filter((card) => card.id !== options.userId && (!options.category || card.categories.includes(options.category)))
    .map((card) => {
      const days = computeSlots(
        rulesBySpecialist.get(card.id) ?? [],
        busyBySpecialist.get(card.id) ?? [],
        options.now,
        { slotMin: options.durationMin, stepMin: BRAND.slotStepMinutes },
      );
      const nextAvailableAt = days.find((day) => day.slots.length)?.slots[0].startAt ?? null;
      return { ...card, nextAvailableAt, selectedPrice: priceForDuration(card.pricing.price, options.durationMin) };
    })
    .filter((card) => {
      if (options.availableToday && (!card.nextAvailableAt || seoulDayKey(card.nextAvailableAt) !== today)) return false;
      if (options.affordableOnly && (!card.nextAvailableAt || options.balance === null || card.selectedPrice > options.balance)) return false;
      return true;
    });

  // Stable sort keeps the existing recommendation order when availability is tied.
  if (options.sort === "soonest") {
    results.sort((a, b) => {
      if (!a.nextAvailableAt) return b.nextAvailableAt ? 1 : 0;
      if (!b.nextAvailableAt) return -1;
      return a.nextAvailableAt.getTime() - b.nextAvailableAt.getTime();
    });
  }
  return results;
}
