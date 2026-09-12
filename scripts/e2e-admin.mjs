// Run against an isolated, freshly seeded dev.db and the matching server: BASE_URL=http://localhost:3000 node scripts/e2e-admin.mjs
// All writes go through real admin forms; this script opens SQLite read-only for assertions.
import { chromium } from "playwright";
import Database from "better-sqlite3";
import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const db = new Database("dev.db", { readonly: true });
const one = (sql, ...params) => db.prepare(sql).get(...params);
const all = (sql, ...params) => db.prepare(sql).all(...params);
const failures = [];
let browser;

function checkStats(id) {
  const actual = one("select review_count, avg_score from specialist_profiles where user_id=?", id);
  const expected = one("select count(*) n, coalesce(avg(score),0) avg from reviews where specialist_id=? and status='visible'", id);
  assert.equal(actual.review_count, expected.n, "visible review count must be refreshed");
  assert.equal(actual.avg_score, Math.round(expected.avg * 10) / 10, "visible average must be refreshed");
}

try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(15_000);
  context.setDefaultNavigationTimeout(30_000);
  await context.addCookies([{ name: "sunbae_locale", value: "en", url: base }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500) failures.push(`${r.status()} ${r.url()}`); });
  const visit = async (path) => {
    const response = await page.goto(`${base}${path}`);
    assert.equal(response?.status(), 200, `route ${path}`);
    await page.locator("main").waitFor();
    assert.deepEqual(failures, [], "browser/runtime errors");
  };
  const formFor = (name, id) => page.locator(`form:has(input[name="${name}"][value="${id}"])`);

  await visit("/login");
  await page.fill('input[name="email"]', "admin@sunbaehub.demo");
  await page.fill('input[name="password"]', "admin1234");
  await page.click('form button[type="submit"]');
  await page.waitForURL(`${base}/admin`);
  console.log("PASS admin login through seeded credentials");
  for (const path of ["/admin", "/admin/specialists", "/admin/withdrawals"]) await visit(path);
  console.log("PASS admin summary, rates, and withdrawals routes");

  const dismissed = one(`select f.id, r.id review_id, r.specialist_id from review_flags f join reviews r on r.id=f.review_id
    where f.status='open' and r.status='flagged' and (select count(*) from review_flags x where x.review_id=r.id)=1
    order by (f.rule='new_account') desc limit 1`);
  assert.ok(dismissed, "fresh seed must contain a single-flag review");
  const countBefore = one("select review_count n from specialist_profiles where user_id=?", dismissed.specialist_id).n;
  await visit("/admin/flags");
  const dismissForm = formFor("flagId", dismissed.id).filter({ has: page.locator('input[name="decision"][value="dismissed"]') });
  await dismissForm.locator('button[type="submit"]').click();
  await dismissForm.waitFor({ state: "detached" });
  assert.equal(one("select status from review_flags where id=?", dismissed.id).status, "dismissed");
  assert.equal(one("select status from reviews where id=?", dismissed.review_id).status, "visible");
  assert.equal(one("select review_count n from specialist_profiles where user_id=?", dismissed.specialist_id).n, countBefore + 1);
  checkStats(dismissed.specialist_id);
  console.log("PASS dismiss: review restored and specialist statistics updated");

  const confirmed = one(`select f.id, r.id review_id, r.reviewer_id, r.specialist_id from review_flags f join reviews r on r.id=f.review_id
    where f.status='open' and r.status='flagged' limit 1`);
  assert.ok(confirmed, "fresh seed must contain another open flag");
  const users = [confirmed.reviewer_id, confirmed.specialist_id];
  const strikesBefore = users.map((id) => one("select strikes from users where id=?", id).strikes);
  const confirmForm = formFor("flagId", confirmed.id).filter({ has: page.locator('input[name="decision"][value="confirmed"]') });
  await confirmForm.locator('button[type="submit"]').click();
  await confirmForm.waitFor({ state: "detached" });
  await page.reload();
  assert.equal(one("select status from review_flags where id=?", confirmed.id).status, "confirmed");
  assert.equal(one("select status from reviews where id=?", confirmed.review_id).status, "hidden");
  users.forEach((id, i) => assert.equal(one("select strikes from users where id=?", id).strikes, strikesBefore[i] + 1));
  checkStats(confirmed.specialist_id);
  console.log("PASS confirm: review hidden and each participant struck exactly once after refresh");

  const dispute = one(`select d.id, d.booking_id, b.price, b.seeker_id, b.specialist_id from disputes d join bookings b on b.id=d.booking_id
    join users u on u.id=b.seeker_id where d.status='open' and u.email='seoyun@korea.ac.kr' limit 1`);
  assert.ok(dispute, "fresh seed must contain the seeded dispute");
  const platform = one("select id from users where is_platform=1").id;
  const fee = Math.round(dispute.price * 0.05), refund = Math.round(dispute.price * 0.5) - fee;
  const expected = [[dispute.seeker_id, "booking_refund", refund], [dispute.specialist_id, "booking_release", dispute.price - refund - fee], [platform, "platform_fee", fee]];
  await visit("/admin/disputes");
  const before = expected.map(([id]) => one("select credit_balance n from users where id=?", id).n);
  const disputeForm = formFor("disputeId", dispute.id);
  await disputeForm.locator('input[name="note"]').fill("Demo check: reviewed session transcript.");
  await disputeForm.locator('button[value="approved"]').click();
  await disputeForm.waitFor({ state: "detached" });
  const resolved = one("select status, admin_note from disputes where id=?", dispute.id);
  assert.equal(resolved.status, "approved");
  assert.equal(resolved.admin_note, "Demo check: reviewed session transcript.");
  assert.equal(one("select status from bookings where id=?", dispute.booking_id).status, "refunded");
  const ledger = all("select user_id, type, amount from credit_transactions where booking_id=?", dispute.booking_id);
  assert.equal(ledger.reduce((sum, row) => sum + row.amount, 0), 0, "booking ledger must conserve credits");
  assert.equal(ledger.filter((row) => row.type !== "booking_hold").length, 3);
  expected.forEach(([id, type, amount], i) => {
    assert.deepEqual(ledger.filter((row) => row.user_id === id && row.type === type).map((row) => row.amount), [amount]);
    assert.equal(one("select credit_balance n from users where id=?", id).n - before[i], amount);
  });
  console.log(`PASS dispute: note saved; ${dispute.price} credits split ${refund}/${dispute.price - refund - fee}/${fee}`);

  const pending = one(`select u.id from users u join specialist_profiles p on p.user_id=u.id where u.email='seoyeon@sunbaehub.demo' and p.verification='pending'`);
  assert.ok(pending, "fresh seed must contain pending expert Seoyeon");
  await visit("/specialists");
  assert.equal(await page.locator(`main a[href="/specialists/${pending.id}"]`).count(), 0);
  await visit("/admin/verifications");
  const verificationForm = formFor("userId", pending.id);
  await verificationForm.locator('input[name="baseRate"]').fill("120");
  await verificationForm.locator('button[value="verified"]').click();
  await verificationForm.waitFor({ state: "detached" });
  assert.deepEqual(one("select verification, base_price from specialist_profiles where user_id=?", pending.id), { verification: "verified", base_price: 120 });
  await visit("/specialists");
  await page.locator(`main a[href="/specialists/${pending.id}"]`).first().waitFor();
  assert.deepEqual(failures, [], "no page errors or HTTP 500 responses");
  console.log("PASS verification: admin-set rate saved and approved expert publicly listed");
} finally {
  try { await browser?.close(); } finally { db.close(); }
}
