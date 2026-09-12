// Run against an isolated production app with an empty disposable database:
// BROWSER_DATABASE_IS_DISPOSABLE=1 BASE_URL=http://localhost:3113 node scripts/e2e-qol.mjs
// First create the schema with drizzle-kit in that disposable project. Never run against the working app/database.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { chromium } from "playwright";

assert.equal(process.env.BROWSER_DATABASE_IS_DISPOSABLE, "1", "Use an isolated disposable project/database and explicitly set BROWSER_DATABASE_IS_DISPOSABLE=1");
const base = process.env.BASE_URL ?? "http://localhost:3113";
assert.notEqual(new URL(base).port, "3000", "Keep the user's app on port 3000 untouched");
const output = resolve(process.env.BROWSER_CHECK_OUTPUT ?? ".impeccable/review");
mkdirSync(output, { recursive: true });
const db = new Database(process.env.DB_PATH ?? "dev.db");
db.pragma("foreign_keys = ON");
assert.equal(db.prepare("select count(*) n from users").get().n, 0, "Use an empty fixture database; this script never resets existing user data");
const minute = 60_000;
const hour = 60 * minute;
const now = Date.now();
const seoulOffset = 9 * hour;
const seoul = new Date(now + seoulOffset);
const today = Date.UTC(seoul.getUTCFullYear(), seoul.getUTCMonth(), seoul.getUTCDate()) - seoulOffset;
const todayDow = seoul.getUTCDay();
const earliestMinute = Math.ceil((now + 150 * minute - today) / (30 * minute)) * 30;
const hasTodaySlots = earliestMinute + 120 <= 1440;
const fixtureDay = hasTodaySlots ? todayDow : (todayDow + 1) % 7;
const firstMinute = hasTodaySlots ? earliestMinute : 9 * 60;
const failures = [];
let browser;

const one = (sql, ...params) => db.prepare(sql).get(...params);
const all = (sql, ...params) => db.prepare(sql).all(...params);
const insert = (table, values) => {
  const keys = Object.keys(values);
  db.prepare(`insert into ${table} (${keys.join(",")}) values (${keys.map(() => "?").join(",")})`).run(...Object.values(values));
};
const balance = (id) => one("select credit_balance n from users where id=?", id).n;
const booking = (id) => one("select * from bookings where id=?", id);
const users = { directory: "qol-directory-seeker", seeker: "qol-cancel-seeker", specialist: "qol-cancel-specialist", platform: "qol-platform" };
const ids = { early: "qol-early", late: "qol-late", expensive: "qol-expensive", none: "qol-no-slots", tomorrow: "qol-tomorrow", short: "qol-short" };

function makeUser(id, name, creditBalance = 0, flags = {}) {
  insert("users", { id, name, email: `${id}@example.test`, credit_balance: creditBalance, created_at: now, ...flags });
}
function makeProfile(id, name, basePrice, rank, categories, hasResume = true) {
  makeUser(id, name, 0, { is_specialist: 1, is_seeker: 0 });
  insert("specialist_profiles", {
    user_id: id, headline: `${name} · 취업 준비 상담`, bio: "지원 직무에 맞는 준비 과정을 함께 검토해요.",
    categories: JSON.stringify(categories), base_price: basePrice, education: "[]", experience: "[]",
    resume_path: hasResume ? "seed-assets/cv/seojun.pdf" : null, verification: "verified", rank_score: rank,
  });
}
function availability(id, dayOfWeek, startMinute, endMinute) {
  insert("availability_rules", { id: randomBytes(12).toString("hex"), specialist_id: id, day_of_week: dayOfWeek, start_minute: startMinute, end_minute: endMinute });
}
function makeBooking(id, startAt, price = 101) {
  insert("bookings", {
    id, seeker_id: users.seeker, specialist_id: users.specialist, category: "resume", start_at: startAt,
    end_at: startAt + hour, duration_min: 60, price, price_note: "테스트 상담", status: "confirmed", seeker_note: id, created_at: now,
  });
}

db.transaction(() => {
  makeUser(users.directory, "김취준", 70);
  makeUser(users.seeker, "이상담", 1000);
  makeUser(users.platform, "플랫폼", 0, { is_seeker: 0, is_platform: 1 });
  makeProfile(users.specialist, "정선배", 100, 0, ["resume"], false);
  makeProfile(ids.early, "김빠른", 100, 20, ["resume"]);
  makeProfile(ids.late, "박합리", 60, 90, ["resume", "portfolio"]);
  makeProfile(ids.expensive, "최전문", 200, 99, ["portfolio"]);
  makeProfile(ids.none, "이준비", 50, 100, ["resume"]);
  makeProfile(ids.tomorrow, "한내일", 100, 80, ["resume"]);
  makeProfile(ids.short, "윤짧은", 60, 70, ["portfolio"]);
  availability(ids.early, fixtureDay, firstMinute, firstMinute + 60);
  availability(ids.late, fixtureDay, firstMinute + 60, firstMinute + 120);
  availability(ids.expensive, fixtureDay, firstMinute, firstMinute + 60);
  availability(ids.short, fixtureDay, firstMinute + 30, firstMinute + 60);
  availability(ids.tomorrow, (todayDow + 1) % 7, 12 * 60, 14 * 60);
  makeBooking("qol-full-refund", now + 48 * hour);
  makeBooking("qol-split-refund", now + 12 * hour);
  makeBooking("qol-specialist-refund", now + 13 * hour);
  makeBooking("qol-stale-refund", now + 49 * hour);
})();

async function pageFor(userId, locale = "ko") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  context.setDefaultTimeout(15_000);
  context.setDefaultNavigationTimeout(30_000);
  const cookies = [{ name: "sunbae_locale", value: locale, url: base }];
  if (userId) {
    const token = randomBytes(32).toString("base64url");
    insert("sessions", { id: createHash("sha256").update(token).digest("hex"), user_id: userId, created_at: now, expires_at: now + 24 * hour });
    cookies.push({ name: "sunbae_session", value: token, url: base });
  }
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`); });
  return page;
}
async function capture(page, name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow`);
  if (process.env.BROWSER_CHECK_SCREENSHOTS !== "0") await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, animations: "disabled" });
}
async function bothSizes(page, name) {
  await capture(page, `${name}-desktop`);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, `${name}-mobile`);
  await page.setViewportSize({ width: 1280, height: 960 });
}
async function openCancellation(page, id, route) {
  await page.goto(`${base}${route}`);
  const panel = page.getByTestId(`cancellation-preview-${id}`);
  await panel.locator("summary").click();
  return panel;
}
function assertSettlement(id, expectedSeeker, expectedSpecialist, expectedFee) {
  assert.equal(booking(id).status, "cancelled");
  const rows = all("select user_id,amount,type from credit_transactions where booking_id=?", id);
  const credit = (userId) => rows.filter((r) => r.user_id === userId).reduce((sum, row) => sum + row.amount, 0);
  assert.equal(credit(users.seeker), expectedSeeker);
  assert.equal(credit(users.specialist), expectedSpecialist);
  assert.equal(credit(users.platform), expectedFee);
  assert.equal(expectedSeeker + expectedSpecialist + expectedFee, booking(id).price);
}
const cards = (page) => page.locator("main ul.grid > li > a");
async function cardIds(page) {
  return cards(page).evaluateAll((links) => links.map((link) => new URL(link.href).pathname.split("/").pop()));
}
async function applyFilters(page, values) {
  const form = page.locator('form[action="/specialists"]');
  if (values.duration !== undefined) await form.locator('[name="duration"]').selectOption(String(values.duration));
  if (values.sort !== undefined) await form.locator('[name="sort"]').selectOption(values.sort);
  if (values.today !== undefined) await form.locator('[name="today"]').setChecked(values.today);
  if (values.affordable !== undefined) await form.locator('[name="affordable"]').setChecked(values.affordable);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/specialists" && url.searchParams.has("duration")),
    form.getByRole("button", { name: "적용", exact: true }).click(),
  ]);
  await page.waitForLoadState("networkidle");
}

try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const seeker = await pageFor(users.seeker);
  const specialist = await pageFor(users.specialist, "en");
  const directory = await pageFor(users.directory);
  const guest = await pageFor(null, "en");

  // Every displayed refund must be the actual amount applied to the ledger.
  for (const [id, expected] of [["qol-full-refund", 101], ["qol-split-refund", 46]]) {
    const panel = await openCancellation(seeker, id, "/me/bookings");
    assert.equal(await panel.locator('input[name="expectedRefund"]').inputValue(), String(expected));
    assert.ok((await panel.innerText()).includes(`${expected} 크레딧`));
    if (expected === 46) {
      assert.ok((await panel.innerText()).includes("50 크레딧"));
      assert.ok((await panel.innerText()).includes("5 크레딧"));
      await bothSizes(seeker, "qol-refund-seeker");
    }
    const before = balance(users.seeker);
    await panel.locator('button[type="submit"]').click();
    await seeker.waitForURL(/cancelled=1/);
    assert.equal(balance(users.seeker) - before, expected);
    assertSettlement(id, expected, expected === 101 ? 0 : 50, expected === 101 ? 0 : 5);
  }
  console.log("PASS refund preview: full and late odd-price cancellation amounts exactly match balances and ledger splits");

  const expertPanel = await openCancellation(specialist, "qol-specialist-refund", "/specialist/dashboard");
  assert.equal(await expertPanel.locator('input[name="expectedRefund"]').inputValue(), "101");
  await bothSizes(specialist, "qol-refund-specialist");
  const beforeExpertCancellation = balance(users.seeker);
  await expertPanel.locator('button[type="submit"]').click();
  await specialist.waitForURL(/cancelled=1/);
  assert.equal(balance(users.seeker) - beforeExpertCancellation, 101);
  assertSettlement("qol-specialist-refund", 101, 0, 0);
  console.log("PASS specialist cancellation: student receives full credits even within 24 hours");

  const stale = await openCancellation(seeker, "qol-stale-refund", "/me/bookings");
  assert.equal(await stale.locator('input[name="expectedRefund"]').inputValue(), "101");
  db.prepare("update bookings set start_at=?,end_at=? where id=?").run(Date.now() + 12 * hour, Date.now() + 13 * hour, "qol-stale-refund");
  const staleBalance = balance(users.seeker);
  await stale.locator('button[type="submit"]').click();
  await seeker.waitForURL(/refundChanged=qol-stale-refund/);
  assert.equal(booking("qol-stale-refund").status, "confirmed");
  assert.equal(balance(users.seeker), staleBalance);
  assert.equal(one("select count(*) n from credit_transactions where booking_id=?", "qol-stale-refund").n, 0);
  const refreshed = seeker.getByTestId("cancellation-preview-qol-stale-refund");
  assert.equal(await refreshed.getAttribute("open"), "");
  assert.equal(await refreshed.locator('input[name="expectedRefund"]').inputValue(), "46");
  await refreshed.getByRole("alert").waitFor();
  await refreshed.locator('button[type="submit"]').click();
  await seeker.waitForURL(/cancelled=1/);
  assertSettlement("qol-stale-refund", 46, 50, 5);
  console.log("PASS stale quote: changed refund requires a fresh confirmation before any cancellation or credit movement");

  // Displayed duration, price, and real bookable availability agree with checkout.
  await directory.goto(`${base}/specialists`);
  const recommended = [ids.none, ids.expensive, ids.late, ids.tomorrow, ids.short, ids.early];
  assert.deepEqual(await cardIds(directory), recommended);
  assert.equal(await directory.locator('#directory-duration').inputValue(), "30");
  assert.equal(await directory.locator('#directory-sort').inputValue(), "recommended");
  // Direct href selection avoids matching profile links in the global navigation.
  const earlyLink = directory.locator(`main ul.grid a[href="/specialists/${ids.early}?duration=30"]`);
  assert.ok((await earlyLink.innerText()).includes("50 크레딧"));
  const nextSlot = await earlyLink.locator("time").getAttribute("datetime");
  assert.ok(new Date(nextSlot).getTime() >= now + 120 * minute);
  assert.equal(await directory.locator(`main ul.grid a[href="/specialists/${ids.none}?duration=30"] time`).count(), 0);
  await bothSizes(directory, "qol-directory-default");
  await earlyLink.click();
  await directory.waitForURL(`${base}/specialists/${ids.early}?duration=30`);
  const bookingForm = directory.locator('form:has(input[name="specialistId"])');
  assert.equal(await bookingForm.locator('input[name="durationMin"]').inputValue(), "30");
  assert.equal(await bookingForm.getByRole("button", { name: /^30분/ }).getAttribute("aria-pressed"), "true");
  const expectedTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(nextSlot));
  assert.equal((await bookingForm.locator("button.tnum").first().innerText()).trim(), expectedTime);
  await directory.goto(`${base}/specialists`);
  await applyFilters(directory, { affordable: true });
  assert.deepEqual(await cardIds(directory), [ids.late, ids.tomorrow, ids.short, ids.early]);
  await applyFilters(directory, { duration: 60 });
  assert.deepEqual(await cardIds(directory), [ids.late]);
  assert.ok((await cards(directory).first().innerText()).includes("60 크레딧"));
  assert.match(await cards(directory).first().getAttribute("href"), /duration=60/);
  await cards(directory).first().click();
  await directory.waitForURL(`${base}/specialists/${ids.late}?duration=60`);
  assert.equal(await directory.locator('input[name="durationMin"]').inputValue(), "60");
  console.log("PASS discovery: 30/60-minute prices and preserved checkout duration match real credit affordability; unavailable experts are excluded by affordability");

  await directory.goto(`${base}/specialists?duration=30&sort=soonest`);
  const sorted = await cards(directory).evaluateAll((links) => links.map((link) => ({ id: new URL(link.href).pathname.split("/").pop(), next: link.querySelector("time")?.dateTime ?? null })));
  const times = sorted.filter((row) => row.next).map((row) => new Date(row.next).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.equal(sorted.at(-1).id, ids.none);
  assert.equal(sorted.at(-1).next, null);
  assert.ok(sorted.findIndex((r) => r.id === ids.expensive) < sorted.findIndex((r) => r.id === ids.early), "equal slots preserve recommendation order");
  await applyFilters(directory, { affordable: true, today: true });
  assert.deepEqual(new Set(await cardIds(directory)), new Set(hasTodaySlots ? [ids.early, ids.late, ids.short] : []));
  for (const row of await cards(directory).locator("time").evaluateAll((elements) => elements.map((element) => element.dateTime))) {
    const day = new Date(new Date(row).getTime() + seoulOffset).toISOString().slice(0, 10);
    assert.equal(day, seoul.toISOString().slice(0, 10));
  }
  await directory.getByRole("navigation", { name: "상담 분야 필터" }).getByRole("link", { name: "자기소개서 첨삭", exact: true }).click();
  await directory.waitForURL((url) => url.searchParams.get("category") === "resume");
  assert.equal(await directory.getByRole("navigation", { name: "상담 분야 필터" }).getByRole("link", { name: "자기소개서 첨삭", exact: true }).getAttribute("aria-current"), "true");
  const filteredUrl = new URL(directory.url());
  for (const [key, value] of Object.entries({ duration: "30", sort: "soonest", today: "1", affordable: "1", category: "resume" })) assert.equal(filteredUrl.searchParams.get(key), value);
  assert.deepEqual(new Set(await cardIds(directory)), new Set(hasTodaySlots ? [ids.early, ids.late] : []));
  await bothSizes(directory, "qol-directory-filtered");
  await directory.getByRole("link", { name: "필터 초기화", exact: true }).first().click();
  await directory.waitForURL(`${base}/specialists`);
  assert.equal(new URL(directory.url()).search, "");
  assert.deepEqual(await cardIds(directory), recommended);
  assert.equal(await directory.locator('[name="today"]').isChecked(), false);
  assert.equal(await directory.locator('[name="affordable"]').isChecked(), false);
  assert.equal(await directory.locator('#directory-duration').inputValue(), "30");
  assert.equal(await directory.locator('#directory-sort').inputValue(), "recommended");
  console.log(`PASS discovery: Seoul-today filter (${hasTodaySlots ? "available today" : "no remaining slots today"}), chronological sort, composed category filters, and reset`);

  await directory.goto(`${base}/specialists?duration=60&category=portfolio&sort=soonest`);
  assert.deepEqual(await cardIds(directory), [ids.expensive, ids.late, ids.short]);
  assert.equal(await directory.locator(`main ul.grid a[href="/specialists/${ids.short}?duration=60"] time`).count(), 0, "a 30-minute-only availability window does not become a 60-minute session");
  await directory.goto(`${base}/specialists?duration=30&affordable=1&balance=9999`);
  assert.deepEqual(await cardIds(directory), [ids.late, ids.tomorrow, ids.short, ids.early], "client query cannot override actual account balance");
  db.prepare("update users set credit_balance=0 where id=?").run(users.directory);
  await directory.goto(`${base}/specialists?duration=30&affordable=1`);
  assert.equal(await cards(directory).count(), 0);
  await directory.getByRole("link", { name: "필터 초기화", exact: true }).last().waitFor();
  await bothSizes(directory, "qol-directory-empty");
  db.prepare("update users set credit_balance=70 where id=?").run(users.directory);
  console.log("PASS discovery: duration-specific availability, trusted account balance, and recoverable no-results state");

  await guest.goto(`${base}/specialists`);
  assert.equal(await guest.locator('[name="affordable"]').isDisabled(), true);
  const loginHref = await guest.locator("#directory-credit-login").getAttribute("href");
  assert.equal(new URL(new URL(loginHref, base).searchParams.get("next"), base).searchParams.get("affordable"), "1");
  await guest.goto(`${base}/specialists?duration=60&sort=soonest&category=portfolio&today=1&affordable=1`);
  assert.equal(new URL(guest.url()).pathname, "/login");
  const next = new URL(new URL(guest.url()).searchParams.get("next"), base);
  for (const [key, value] of Object.entries({ duration: "60", sort: "soonest", category: "portfolio", today: "1", affordable: "1" })) assert.equal(next.searchParams.get(key), value);
  await guest.goto(`${base}/specialists/${ids.late}?duration=60`);
  assert.equal(await guest.locator('input[name="durationMin"]').inputValue(), "60");
  const bookLogin = guest.locator('form:has(input[name="specialistId"])').getByRole("link");
  const bookingNext = new URL(await bookLogin.getAttribute("href"), base).searchParams.get("next");
  assert.equal(new URL(bookingNext, base).searchParams.get("duration"), "60");
  await guest.goto(`${base}/specialists?duration=60&sort=soonest`);
  await bothSizes(guest, "qol-directory-guest");
  console.log("PASS guest discovery: affordability requires login with filters preserved, and booking login keeps selected duration");
  assert.deepEqual(failures, [], "no browser errors or server 500 responses");
  console.log(`Screenshots: ${output}`);
} finally {
  try { await browser?.close(); } finally { db.close(); }
}
