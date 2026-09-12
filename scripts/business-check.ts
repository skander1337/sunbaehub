import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import * as schema from "../src/db/schema";
import { BookingRuleError, SlotUnavailable, createBooking, devShiftBooking, endSession, touchSession } from "../src/lib/services/booking";
import { settleBooking, settleDueBookings } from "../src/lib/services/settlement";
import { canChat, chatBlockReason, sessionReadBlockReason, sessionWindow } from "../src/lib/rules/session";
import { CATEGORIES, categoryLabel } from "../src/lib/categories";

// Run with: npx tsx scripts/business-check.ts
// Generate the real application schema in memory; never open or mutate dev.db.
async function main() {
  const sqlite = new Database(":memory:");
  try {
    sqlite.pragma("foreign_keys = ON");
    const empty = await generateSQLiteDrizzleJson({});
    const current = await generateSQLiteDrizzleJson(schema);
    for (const statement of await generateSQLiteMigration(empty, current)) sqlite.exec(statement);
    const db = drizzle({ client: sqlite, schema });
    const now = new Date("2026-09-12T00:00:00.000Z");
    const minute = 60_000;
    db.insert(schema.users).values([
      { id: "seeker", name: "Test Seeker", email: "seeker@example.test", creditBalance: 1000 },
      { id: "expert", name: "Test Expert", email: "expert@example.test", isSpecialist: true },
      { id: "platform", name: "Test Platform", email: "platform@example.test", isPlatform: true },
    ]).run();
    db.insert(schema.specialistProfiles).values({
      userId: "expert", headline: "Test", bio: "Test", categories: ["career"], basePrice: 100,
      education: [], experience: [], verification: "pending",
    }).run();
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      db.insert(schema.availabilityRules).values({ specialistId: "expert", dayOfWeek, startMinute: 0, endMinute: 1440 }).run();
    }
    const input = {
      seekerId: "seeker", specialistId: "expert", startAt: new Date(now.getTime() + 180 * minute),
      category: "career", durationMin: 30,
    };
    for (const verification of ["none", "pending", "rejected"]) {
      db.update(schema.specialistProfiles).set({ verification }).where(eq(schema.specialistProfiles.userId, "expert")).run();
      assert.throws(() => db.transaction((tx) => createBooking(tx, input, now)),
        (error: unknown) => error instanceof BookingRuleError && error.code === "not_verified");
    }
    assert.equal(db.select().from(schema.bookings).all().length, 0);
    assert.equal(db.select().from(schema.creditTransactions).all().length, 0);
    assert.equal(db.select().from(schema.users).where(eq(schema.users.id, "seeker")).get()!.creditBalance, 1000);
    db.update(schema.specialistProfiles).set({ verification: "verified" }).where(eq(schema.specialistProfiles.userId, "expert")).run();
    const booked = db.transaction((tx) => createBooking(tx, input, now));
    assert.equal(booked.price, 50);
    assert.equal(booked.endAt.getTime() - booked.startAt.getTime(), 30 * minute);
    assert.equal(db.select().from(schema.users).where(eq(schema.users.id, "seeker")).get()!.creditBalance, 950);
    assert.throws(() => db.transaction((tx) => createBooking(tx, input, now)), SlotUnavailable);
    assert.equal(db.select().from(schema.creditTransactions).all().length, 1);
    console.log("PASS: verification, booking charge, and duplicate-slot protection");

    const customPurposeInput = { ...input, category: "other", startAt: new Date(input.startAt.getTime() + 60 * minute) };
    const beforeInvalidPurpose = {
      bookings: db.select().from(schema.bookings).all(),
      transactions: db.select().from(schema.creditTransactions).all(),
      notifications: db.select().from(schema.notifications).all(),
      balance: db.select().from(schema.users).where(eq(schema.users.id, "seeker")).get()!.creditBalance,
    };
    for (const note of [undefined, "", "  \n\t ", "\u3000"]) {
      assert.throws(() => db.transaction((tx) => createBooking(tx, { ...customPurposeInput, note }, now)),
        (error: unknown) => error instanceof BookingRuleError && error.code === "other_purpose_required");
    }
    assert.throws(() => db.transaction((tx) => createBooking(tx, { ...customPurposeInput, note: "a".repeat(501) }, now)),
      (error: unknown) => error instanceof BookingRuleError && error.code === "note_length");
    assert.throws(() => db.transaction((tx) => createBooking(tx, { ...customPurposeInput, category: "resume", note: "a".repeat(501) }, now)),
      (error: unknown) => error instanceof BookingRuleError && error.code === "note_length");
    assert.deepEqual({
      bookings: db.select().from(schema.bookings).all(),
      transactions: db.select().from(schema.creditTransactions).all(),
      notifications: db.select().from(schema.notifications).all(),
      balance: db.select().from(schema.users).where(eq(schema.users.id, "seeker")).get()!.creditBalance,
    }, beforeInvalidPurpose, "invalid custom purposes must not reserve a slot or charge credits");
    const customPurpose = db.transaction((tx) => createBooking(tx, {
      ...customPurposeInput, note: "  첫 인턴 지원 준비 순서를 상담하고 싶어요.  ",
    }, now));
    assert.equal(customPurpose.category, "other");
    assert.equal(customPurpose.seekerNote, "첫 인턴 지원 준비 순서를 상담하고 싶어요.");
    assert.equal(customPurpose.price, 50);
    assert.equal(db.select().from(schema.users).where(eq(schema.users.id, "seeker")).get()!.creditBalance, 900);
    assert.equal(categoryLabel("other", "ko"), "기타");
    assert.equal(categoryLabel("other", "en"), "Other");
    assert.equal(CATEGORIES.some((category) => String(category.id) === "other"), false, "custom purpose is not specialist expertise");
    const maxLengthPurpose = db.transaction((tx) => createBooking(tx, {
      ...customPurposeInput, startAt: new Date(customPurposeInput.startAt.getTime() + 60 * minute), note: `  ${"가".repeat(500)}  `,
    }, now));
    assert.equal(maxLengthPurpose.seekerNote, "가".repeat(500));
    console.log("PASS: Other purpose requires an explanation, rejects oversize notes without side effects, and saves valid details");

    const bookingById = (id: string) => db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get()!;
    for (const userId of ["seeker", "expert"]) {
      for (const status of ["confirmed", "in_progress"]) {
        const live = { ...booked, status };
        for (const offset of [-5 * minute, -1]) {
          const beforeStart = new Date(live.startAt.getTime() + offset);
          assert.equal(sessionWindow(live, beforeStart), "early");
          assert.equal(canChat(live, userId, beforeStart), false);
          assert.equal(chatBlockReason(live, userId, beforeStart), "early");
          assert.equal(sessionReadBlockReason(live, userId, beforeStart), "early");
        }
        assert.equal(canChat(live, userId, live.startAt), true);
        assert.equal(chatBlockReason(live, userId, live.startAt), null);
        assert.equal(sessionReadBlockReason(live, userId, live.startAt), null);
        const graceEnd = new Date(live.endAt.getTime() + 5 * minute);
        assert.equal(canChat(live, userId, graceEnd), true);
        assert.equal(chatBlockReason(live, userId, new Date(graceEnd.getTime() + 1)), "closed");
      }
      for (const status of ["completed", "cancelled", "disputed", "refunded"]) {
        const past = { ...booked, status };
        assert.equal(canChat(past, userId, past.endAt), false);
        assert.equal(chatBlockReason(past, userId, past.endAt), "status");
        assert.equal(sessionReadBlockReason(past, userId, past.endAt), null, "past transcript remains readable");
      }
      const beforeStart = new Date(booked.startAt.getTime() - 1);
      assert.equal(touchSession(db, booked, beforeStart).status, "confirmed");
      assert.equal(bookingById(booked.id).status, "confirmed");
      assert.throws(() => db.transaction((tx) => endSession(tx, booked.id, userId, beforeStart)),
        (error: unknown) => error instanceof BookingRuleError && error.code === "not_endable");
      assert.equal(bookingById(booked.id).status, "confirmed");
    }
    assert.equal(chatBlockReason(booked, "outsider", booked.startAt), "not_participant");
    assert.equal(sessionReadBlockReason(booked, "outsider", booked.endAt), "not_participant");
    for (const userId of ["seeker", "expert"]) {
      const id = `exact-start-${userId}`;
      db.insert(schema.bookings).values({ ...booked, id }).run();
      assert.equal(touchSession(db, bookingById(id), booked.startAt).status, "in_progress");
      assert.equal(bookingById(id).status, "in_progress");
      assert.equal(db.transaction((tx) => endSession(tx, id, userId, booked.startAt)).status, "completed");
    }
    console.log("PASS: both participants are blocked until exact start, end grace is retained, and past transcripts are read-only");

    for (const durationMin of [30, 60]) {
      const id = `demo-${durationMin}`;
      db.insert(schema.bookings).values({
        id, seekerId: "seeker", specialistId: "expert", category: "career", durationMin,
        startAt: new Date(now.getTime() + 180 * minute), endAt: new Date(now.getTime() + (180 + durationMin) * minute),
        price: 100, priceNote: "Test", status: "confirmed",
      }).run();
      // End a future booking directly; the window must remain valid and retain its duration.
      devShiftBooking(db, id, "end_now", now);
      let shifted = bookingById(id);
      assert.equal(shifted.endAt.getTime() - shifted.startAt.getTime(), durationMin * minute);
      assert.equal(sessionWindow(shifted, now), "closed");
      devShiftBooking(db, id, "start_now", now);
      shifted = bookingById(id);
      assert.equal(shifted.endAt.getTime() - shifted.startAt.getTime(), durationMin * minute);
      assert.equal(sessionWindow(shifted, now), "open");
      db.update(schema.bookings).set({ status: "in_progress" }).where(eq(schema.bookings.id, id)).run();
      devShiftBooking(db, id, "end_now", now);
      shifted = bookingById(id);
      assert.equal(shifted.endAt.getTime() - shifted.startAt.getTime(), durationMin * minute);
      assert.equal(sessionWindow(shifted, now), "closed");
      db.update(schema.bookings).set({ status: "cancelled", settledAt: now }).where(eq(schema.bookings.id, id)).run();
      const finishedWindow = bookingById(id);
      devShiftBooking(db, id, "start_now", now);
      devShiftBooking(db, id, "end_now", now);
      assert.deepEqual(bookingById(id), finishedWindow);
    }
    console.log("PASS: 30/60-minute demo controls preserve duration and valid windows");

    function completedBooking(id: string, status = "completed") {
      const endAt = new Date(now.getTime() - 30 * 60 * minute);
      db.insert(schema.bookings).values({
        id, seekerId: "seeker", specialistId: "expert", category: "career", durationMin: 60,
        startAt: new Date(endAt.getTime() - 60 * minute), endAt, price: 100,
        priceNote: "Test", status, completedAt: status === "completed" ? endAt : null,
      }).run();
      return bookingById(id);
    }
    const payoutRows = (id: string) => db.select().from(schema.creditTransactions).where(eq(schema.creditTransactions.bookingId, id)).all();
    const balance = (id: string) => db.select().from(schema.users).where(eq(schema.users.id, id)).get()!.creditBalance;
    const retryBooking = completedBooking("settlement-retry");
    sqlite.exec(`CREATE TRIGGER fail_platform_fee BEFORE INSERT ON credit_transactions
      WHEN NEW.type = 'platform_fee' BEGIN SELECT RAISE(ABORT, 'injected platform failure'); END`);
    assert.throws(() => settleBooking(db, retryBooking, now), /injected platform failure/);
    assert.equal(bookingById(retryBooking.id).settledAt, null);
    assert.equal(payoutRows(retryBooking.id).length, 0);
    assert.equal(balance("expert"), 0);
    assert.equal(balance("platform"), 0);
    sqlite.exec("DROP TRIGGER fail_platform_fee");
    assert.equal(settleBooking(db, retryBooking, now), true);
    assert.equal(settleBooking(db, retryBooking, now), false, "stale snapshot must not pay twice");
    assert.equal(payoutRows(retryBooking.id).length, 2);
    assert.equal(balance("expert"), 95);
    assert.equal(balance("platform"), 5);

    const outerBooking = completedBooking("outer-rollback");
    assert.throws(() => db.transaction((tx) => {
      assert.equal(settleBooking(tx, outerBooking, now), true);
      throw new Error("injected outer failure");
    }), /injected outer failure/);
    assert.equal(bookingById(outerBooking.id).settledAt, null);
    assert.equal(payoutRows(outerBooking.id).length, 0);
    assert.equal(balance("expert"), 95);
    assert.equal(db.transaction((tx) => settleBooking(tx, outerBooking, now)), true);
    assert.equal(payoutRows(outerBooking.id).length, 2);
    console.log("PASS: partial-failure rollback, safe retry, and nested transaction rollback");

    const disputed = completedBooking("disputed", "disputed");
    assert.equal(settleBooking(db, disputed, now), false);
    assert.equal(payoutRows(disputed.id).length, 0);
    const ended = completedBooking("ended", "confirmed");
    assert.equal(db.transaction((tx) => settleDueBookings(tx, now)), 1);
    assert.equal(db.transaction((tx) => settleDueBookings(tx, now)), 0);
    assert.equal(bookingById(ended.id).status, "completed");
    assert.equal(payoutRows(ended.id).length, 2);
    const requests = db.select().from(schema.notifications).all().filter((n) => n.href === `/bookings/${ended.id}/review`);
    assert.equal(requests.length, 1);
    console.log("PASS: automatic completion settles once and skips disputed bookings");
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
