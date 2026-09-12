import { fromSeoul, seoulDayKey, seoulParts } from "@/lib/seoul";

export type SlotRule = { dayOfWeek: number; startMinute: number; endMinute: number };
export type BusyRange = { startAt: Date; endAt: Date };
export type Slot = { startAt: Date; endAt: Date };
export type DaySlots = { dateKey: string; dayStart: Date; dow: number; slots: Slot[] };

export type SlotOptions = { days?: number; slotMin?: number; leadMin?: number };

/** Bookable slots for the next `days` Seoul days from weekly rules, minus busy ranges and anything sooner than `leadMin`. */
export function computeSlots(rules: SlotRule[], busy: BusyRange[], now: Date, opts: SlotOptions = {}): DaySlots[] {
  const { days = 14, slotMin = 60, leadMin = 120 } = opts;
  const p = seoulParts(now);
  const earliest = now.getTime() + leadMin * 60_000;
  const out: DaySlots[] = [];
  for (let d = 0; d < days; d++) {
    const dayStart = fromSeoul(p.y, p.m, p.d + d, 0);
    const dow = seoulParts(dayStart).dow;
    const slots: Slot[] = [];
    for (const r of rules) {
      if (r.dayOfWeek !== dow) continue;
      for (let t = r.startMinute; t + slotMin <= r.endMinute; t += slotMin) {
        const startAt = fromSeoul(p.y, p.m, p.d + d, t);
        const endAt = new Date(startAt.getTime() + slotMin * 60_000);
        if (startAt.getTime() < earliest) continue;
        if (busy.some((b) => startAt < b.endAt && endAt > b.startAt)) continue;
        slots.push({ startAt, endAt });
      }
    }
    slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    out.push({ dateKey: seoulDayKey(dayStart), dayStart, dow, slots });
  }
  return out;
}

export function slotExists(days: DaySlots[], startAt: Date): boolean {
  const t = startAt.getTime();
  return days.some((d) => d.slots.some((s) => s.startAt.getTime() === t));
}
