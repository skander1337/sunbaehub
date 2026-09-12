import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import * as schema from "../src/db/schema";
import { cancellationQuote } from "../src/lib/rules/refund";
import { BookingRuleError, cancelBooking } from "../src/lib/services/booking";

// Run with: npx tsx scripts/refund-check.ts. Only an in-memory database is used.
async function main() {
  const sqlite = new Database(":memory:");
  try {
    sqlite.pragma("foreign_keys = ON");
    const empty = await generateSQLiteDrizzleJson({});
    const current = await generateSQLiteDrizzleJson(schema);
    for (const statement of await generateSQLiteMigration(empty, current)) sqlite.exec(statement);
    const db = drizzle({ client: sqlite, schema });
    db.insert(schema.users).values([
      { id: "seeker", name: "Refund Seeker", email: "refund-seeker@example.test" },
      { id: "expert", name: "Refund Expert", email: "refund-expert@example.test", isSpecialist: true },
      { id: "outsider", name: "Outsider", email: "refund-outsider@example.test" },
      { id: "platform", name: "Platform", email: "refund-platform@example.test", isPlatform: true },
    ]).run();
    const startAt = new Date("2026-09-15T11:00:00.000Z");
    const boundary = new Date(startAt.getTime() - 24 * 3_600_000);
    const fullTime = new Date(boundary.getTime() - 1);
    const snapshot = () => ({
      users: db.select().from(schema.users).all(),
      bookings: db.select().from(schema.bookings).all(),
      transactions: db.select().from(schema.creditTransactions).all(),
      notifications: db.select().from(schema.notifications).all(),
    });
    const insertBooking = (id: string, price: number, status = "confirmed") => db.insert(schema.bookings).values({
      id, seekerId: "seeker", specialistId: "expert", category: "career", durationMin: 60,
      startAt, endAt: new Date(startAt.getTime() + 3_600_000), price, priceNote: "Refund test", status,
    }).run();
    const ruleError = (code: string) => (error: unknown) => error instanceof BookingRuleError && error.code === code;

    for (const [price, split] of [
      [100, { seekerRefund: 45, platformFee: 5, specialistPayout: 50 }],
      [101, { seekerRefund: 46, platformFee: 5, specialistPayout: 50 }],
      [120, { seekerRefund: 54, platformFee: 6, specialistPayout: 60 }],
      [205, { seekerRefund: 93, platformFee: 10, specialistPayout: 102 }],
    ] as const) {
      const full = { outcome: "full_refund", seekerRefund: price, platformFee: 0, specialistPayout: 0 };
      assert.deepEqual(cancellationQuote(price, startAt, fullTime, "seeker"), full);
      assert.deepEqual(cancellationQuote(price, startAt, boundary, "seeker"), { outcome: "split", ...split });
      assert.deepEqual(cancellationQuote(price, startAt, new Date(boundary.getTime() + 1), "seeker"), { outcome: "split", ...split });
      assert.deepEqual(cancellationQuote(price, startAt, boundary, "specialist"), full);
      assert.equal(split.seekerRefund + split.platformFee + split.specialistPayout, price);

      for (const by of ["seeker", "specialist"] as const) {
        for (const now of [fullTime, boundary]) {
          const id = `${price}-${by}-${now.getTime()}`;
          insertBooking(id, price);
          const quote = cancellationQuote(price, startAt, now, by);
          const userId = by === "seeker" ? "seeker" : "expert";
          assert.equal(db.transaction((tx) => cancelBooking(tx, id, userId, now, quote.seekerRefund)), quote.outcome);
          const entries = db.select().from(schema.creditTransactions).where(eq(schema.creditTransactions.bookingId, id)).all();
          assert.equal(entries.find((entry) => entry.type === "booking_refund")!.amount, quote.seekerRefund);
          assert.equal(entries.find((entry) => entry.type === "booking_release")?.amount ?? 0, quote.specialistPayout);
          assert.equal(entries.find((entry) => entry.type === "platform_fee")?.amount ?? 0, quote.platformFee);
          assert.equal(entries.reduce((total, entry) => total + entry.amount, 0), price);
          const done = snapshot();
          assert.throws(() => db.transaction((tx) => cancelBooking(tx, id, userId, now, quote.seekerRefund)), ruleError("not_cancellable"));
          assert.deepEqual(snapshot(), done, "double submission must not add ledger entries or notifications");
        }
      }
    }
    console.log("PASS: exact full/split quotes match ledger transfers for both roles, odd prices, and the 24-hour boundary");

    insertBooking("crossed-cutoff", 101);
    const before = snapshot();
    assert.throws(() => db.transaction((tx) => cancelBooking(tx, "crossed-cutoff", "seeker", boundary, 101)), ruleError("refund_quote_changed"));
    for (const invalid of [Number.NaN, -1, 46.5, 0, Number.POSITIVE_INFINITY]) {
      assert.throws(() => db.transaction((tx) => cancelBooking(tx, "crossed-cutoff", "seeker", boundary, invalid)), ruleError("refund_quote_changed"));
    }
    assert.deepEqual(snapshot(), before, "stale or missing quotes must not cancel, transfer credits, or notify");
    assert.equal(db.transaction((tx) => cancelBooking(tx, "crossed-cutoff", "seeker", boundary, 46)), "split");
    console.log("PASS: crossing the cutoff or submitting an invalid quote requires confirmation with no side effects");

    insertBooking("guarded", 120);
    const guarded = snapshot();
    assert.throws(() => db.transaction((tx) => cancelBooking(tx, "guarded", "outsider", fullTime, 120)), ruleError("not_participant"));
    assert.throws(() => db.transaction((tx) => cancelBooking(tx, "missing", "seeker", fullTime, 120)), ruleError("not_participant"));
    for (const userId of ["seeker", "expert"]) {
      assert.throws(() => db.transaction((tx) => cancelBooking(tx, "guarded", userId, startAt, 120)), ruleError("not_cancellable"));
    }
    assert.deepEqual(snapshot(), guarded);
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
    console.log("PASS: cancellation remains restricted to participants before the session starts");
  } finally {
    sqlite.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
