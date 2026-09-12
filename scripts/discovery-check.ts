import assert from "node:assert/strict";
import { discoverSpecialists, type SpecialistDiscoveryOptions } from "../src/lib/rules/discovery";
import { fromSeoul, seoulParts } from "../src/lib/seoul";

// Pure checks: no application database is opened or changed.
const date = (day: number, hour: number, minute = 0) => fromSeoul(2026, 8, day, hour * 60 + minute);
const now = date(12, 9);
const options: SpecialistDiscoveryOptions = { durationMin: 30, balance: 100, now };
const candidate = (id: string, price = 100, categories = ["career"]) => ({ id, pricing: { price }, categories });
const rule = (specialistId: string, startHour: number, endHour: number, day = 12) => ({
  specialistId,
  dayOfWeek: seoulParts(date(day, 0)).dow,
  startMinute: startHour * 60,
  endMinute: endHour * 60,
});
const ids = (cards: { id: string }[]) => cards.map((card) => card.id);

const ordinary = [candidate("expert")];
const hours = [rule("expert", 9, 15)];
assert.equal(discoverSpecialists(ordinary, hours, [], options)[0].nextAvailableAt?.getTime(), date(12, 11).getTime());
assert.equal(discoverSpecialists(ordinary, hours, [], { ...options, now: new Date(now.getTime() + 1) })[0].nextAvailableAt?.getTime(), date(12, 11, 30).getTime());
console.log("PASS: discovery applies the exact two-hour booking lead time and next half-hour boundary");

const overlapping = [{ specialistId: "expert", startAt: date(12, 11), endAt: date(12, 12) }];
assert.equal(discoverSpecialists(ordinary, hours, overlapping, options)[0].nextAvailableAt?.getTime(), date(12, 12).getTime());
const adjacent = [{ specialistId: "expert", startAt: date(12, 11, 30), endAt: date(12, 12, 30) }];
assert.equal(discoverSpecialists(ordinary, hours, adjacent, options)[0].nextAvailableAt?.getTime(), date(12, 11).getTime());
assert.equal(discoverSpecialists(ordinary, hours, adjacent, { ...options, durationMin: 60 })[0].nextAvailableAt?.getTime(), date(12, 12, 30).getTime());
console.log("PASS: busy appointments block overlaps, allow adjacent slots, and account for the selected duration");

const halfHourOnly = [rule("expert", 11, 11.5)];
assert.equal(discoverSpecialists(ordinary, halfHourOnly, [], { ...options, availableToday: true }).length, 1);
assert.equal(discoverSpecialists(ordinary, halfHourOnly, [], { ...options, durationMin: 60, availableToday: true }).length, 0);
assert.equal(discoverSpecialists(ordinary, halfHourOnly, [], { ...options, durationMin: 60 })[0].nextAvailableAt, null);

const midnightHours = [rule("expert", 2, 3)];
assert.equal(discoverSpecialists(ordinary, midnightHours, [], { ...options, now: date(12, 0), availableToday: true })[0].nextAvailableAt?.getTime(), date(12, 2).getTime());
assert.equal(discoverSpecialists(ordinary, midnightHours, [], { ...options, now: date(11, 23, 30), availableToday: true }).length, 0);
assert.equal(discoverSpecialists(ordinary, midnightHours, [], { ...options, now: date(11, 23, 30) })[0].nextAvailableAt?.getTime(), date(12, 2).getTime());
console.log("PASS: Available today uses Seoul midnight and rejects future-day or too-short availability");

const roundedPrice = [candidate("expert", 105)];
assert.equal(discoverSpecialists(roundedPrice, hours, [], options)[0].selectedPrice, 55);
assert.equal(discoverSpecialists(roundedPrice, hours, [], { ...options, affordableOnly: true, balance: 54 }).length, 0);
assert.equal(discoverSpecialists(roundedPrice, hours, [], { ...options, affordableOnly: true, balance: 55 }).length, 1);
assert.equal(discoverSpecialists(roundedPrice, hours, [], { ...options, affordableOnly: true, balance: 55, durationMin: 60 }).length, 0);
assert.equal(discoverSpecialists(roundedPrice, hours, [], { ...options, affordableOnly: true, balance: null }).length, 0);
assert.equal(discoverSpecialists(roundedPrice, [], [], { ...options, affordableOnly: true, balance: 1000 }).length, 0);
assert.equal(discoverSpecialists(roundedPrice, hours, [], { ...options, affordableOnly: true, balance: 0 }).length, 0);
console.log("PASS: affordability uses checkout rounding, includes an exact balance, and requires a bookable slot and known balance");

const candidates = [candidate("empty"), candidate("later"), candidate("tie-b"), candidate("tie-a"), candidate("empty-2")];
const rules = [rule("later", 14, 15), rule("tie-b", 11, 12), rule("tie-a", 11, 12)];
assert.deepEqual(ids(discoverSpecialists(candidates, rules, [], options)), ["empty", "later", "tie-b", "tie-a", "empty-2"]);
assert.deepEqual(ids(discoverSpecialists(candidates, rules, [], { ...options, sort: "soonest" })), ["tie-b", "tie-a", "later", "empty", "empty-2"]);
assert.deepEqual(ids(discoverSpecialists(candidates, rules, [], { ...options, userId: "tie-b", sort: "soonest" })), ["tie-a", "later", "empty", "empty-2"]);
assert.deepEqual(ids(candidates), ["empty", "later", "tie-b", "tie-a", "empty-2"], "sorting must not change the source recommendation order");
console.log("PASS: soonest sorts null availability last, preserves recommendation ties, and excludes self-booking");

const mixed = [candidate("career"), candidate("expensive", 300), candidate("resume", 100, ["resume"]), candidate("future")];
const mixedRules = [rule("career", 11, 12), rule("expensive", 11, 12), rule("resume", 11, 12), rule("future", 11, 12, 13)];
assert.deepEqual(ids(discoverSpecialists(mixed, mixedRules, [], {
  ...options, category: "career", availableToday: true, affordableOnly: true, balance: 50, sort: "soonest",
})), ["career"]);
const fullyBusy = [{ specialistId: "expert", startAt: now, endAt: date(26, 0) }];
assert.equal(discoverSpecialists(ordinary, hours, fullyBusy, options)[0].nextAvailableAt, null);
assert.deepEqual(discoverSpecialists([], [], [], options), []);
console.log("PASS: category, date, price, and sort combine correctly; no slots beyond the 14-day booking horizon are advertised");
