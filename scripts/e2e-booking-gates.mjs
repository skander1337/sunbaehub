// Run in a disposable, freshly seeded project with its own development server:
// BROWSER_DATABASE_IS_DISPOSABLE=1 BASE_URL=http://localhost:3111 node scripts/e2e-booking-gates.mjs
// This test changes only its local fixture database's booking clock; booking and chat writes use the real UI/API.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { chromium } from "playwright";

assert.equal(process.env.BROWSER_DATABASE_IS_DISPOSABLE, "1", "Run only in an isolated disposable project/database and set BROWSER_DATABASE_IS_DISPOSABLE=1");
const base = process.env.BASE_URL ?? "http://localhost:3111";
const output = resolve(process.env.BROWSER_CHECK_OUTPUT ?? ".impeccable/review");
mkdirSync(output, { recursive: true });
const db = new Database("dev.db");
const one = (sql, ...args) => db.prepare(sql).get(...args);
const seeker = one("select id from users where email='jiwoo@korea.ac.kr'");
const expert = one("select id from users where email='seojun@sunbaehub.demo'");
assert.ok(seeker && expert, "Use a freshly seeded database");
const failures = [];
const formSelector = 'form:has(input[name="specialistId"])';
const note = "지원서 제출 전 해외 인턴 지원 일정과 준비 순서를 함께 정리하고 싶어요.";
let browser;

async function login(email, password, locale) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(15_000);
  context.setDefaultNavigationTimeout(30_000);
  await context.addCookies([{ name: "sunbae_locale", value: locale, url: base }]);
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

async function selectOther(page, value) {
  await page.goto(`${base}/specialists/${expert.id}`);
  const form = page.locator(formSelector);
  await form.locator('button.tnum[aria-pressed="false"]').first().click();
  await form.getByRole("button", { name: "기타", exact: true }).click();
  await form.locator('textarea[name="note"]').fill(value);
  return form;
}

async function capture(page, name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow`);
  if (process.env.BROWSER_CHECK_SCREENSHOTS !== "0") await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
}

try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const a = await login("jiwoo@korea.ac.kr", "hoobae1234", "ko");
  const b = await login("seojun@sunbaehub.demo", "sunbae1234", "en");
  const balanceBefore = one("select credit_balance n from users where id=?", seeker.id).n;
  const countBefore = one("select count(*) n from bookings where seeker_id=?", seeker.id).n;

  // Selecting a normal purpose still leaves preparation notes optional.
  await a.goto(`${base}/specialists/${expert.id}`);
  let form = a.locator(formSelector);
  await form.locator('button.tnum[aria-pressed="false"]').first().click();
  assert.equal(await form.locator('textarea[name="note"]').getAttribute("required"), null);
  assert.equal(await form.locator('button[type="submit"]').isEnabled(), true);

  // Both the UI and the server reject a missing custom purpose, including whitespace.
  for (const value of ["", "   \n  "]) {
    form = await selectOther(a, value);
    assert.equal(await form.locator('textarea[name="note"]').getAttribute("required"), "");
    assert.equal(await form.locator('button[type="submit"]').isDisabled(), true);
    await form.evaluate((element) => {
      element.noValidate = true;
      const button = element.querySelector('button[type="submit"]');
      button.disabled = false;
      element.requestSubmit(button);
    });
    await a.waitForURL(/error=other_purpose_required/);
    assert.equal(one("select count(*) n from bookings where seeker_id=?", seeker.id).n, countBefore);
    assert.equal(one("select credit_balance n from users where id=?", seeker.id).n, balanceBefore);
  }
  console.log("PASS Other: blank and whitespace descriptions blocked by UI and server, with no booking or debit");

  form = await selectOther(a, `  ${note}  `);
  await a.setInputFiles('input[name="attachment"]', "seed-assets/cv/minjae.pdf");
  await form.scrollIntoViewIfNeeded();
  await capture(a, "booking-gates-other-desktop");
  await a.setViewportSize({ width: 390, height: 844 });
  await capture(a, "booking-gates-other-mobile");
  await a.setViewportSize({ width: 1280, height: 900 });
  await form.locator('button[type="submit"]').click();
  await a.waitForURL(/\/me\/bookings\?booked=/);
  const id = new URL(a.url()).searchParams.get("booked");
  const booking = one("select * from bookings where id=?", id);
  assert.equal(booking.category, "other");
  assert.equal(booking.seeker_note, note);
  assert.ok(booking.start_at > Date.now());
  assert.equal(one("select credit_balance n from users where id=?", seeker.id).n, balanceBefore - booking.price);
  console.log("PASS Other: valid description is trimmed, saved, and the normal booking charge is applied");

  await b.goto(`${base}/specialist/dashboard`);
  const aRow = a.locator("main li").filter({ hasText: note });
  const bRow = b.locator("main li").filter({ hasText: note });
  for (const [page, row, label] of [[a, aRow, "시작 전"], [b, bRow, "Not started"]]) {
    await row.waitFor();
    assert.equal(await row.getByRole("button", { name: label, exact: true }).isDisabled(), true);
    assert.equal(await row.locator(`a[href="/sessions/${id}"]`).count(), 0);
    await row.scrollIntoViewIfNeeded();
    assert.ok(await row.getByText(page === a ? /기타/ : /Other/).count());
    const preparationFile = row.getByRole("link", { name: "minjae.pdf", exact: true });
    await preparationFile.waitFor();
    const href = await preparationFile.getAttribute("href");
    const download = await page.request.get(`${base}${href}`);
    assert.equal(download.status(), 200, "each participant can download preparation material before entry");
    assert.match(download.headers()["content-type"], /application\/pdf/);
    assert.equal((await download.body()).subarray(0, 5).toString(), "%PDF-");
  }
  for (const [page, path, name] of [[a, "/me/bookings", "seeker"], [b, "/specialist/dashboard", "specialist"]]) {
    await page.goto(`${base}/sessions/${id}`);
    await page.waitForURL(`${base}${path}?waiting=1`);
    assert.equal(await page.locator('input[maxlength="2000"]').count(), 0);
    await capture(page, `booking-gates-${name}-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, `booking-gates-${name}-mobile`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  console.log("PASS entry: both roles have disabled future entry buttons, preparation PDF downloads, and direct-link redirects to their booking lists");

  const messagesBefore = one("select count(*) n from messages where booking_id=?", id).n;
  const attachmentsBefore = one("select count(*) n from attachments where booking_id=?", id).n;
  for (const page of [a, b]) {
    const responses = await Promise.all([
      page.request.get(`${base}/api/bookings/${id}/messages`),
      page.request.post(`${base}/api/bookings/${id}/messages`, { data: { text: "too early" } }),
      page.request.get(`${base}/api/bookings/${id}/stream`),
      page.request.post(`${base}/api/bookings/${id}/typing`, { data: { typing: true } }),
      page.request.post(`${base}/api/bookings/${id}/files`, { multipart: { file: { name: "minjae.pdf", mimeType: "application/pdf", buffer: readFileSync("seed-assets/cv/minjae.pdf") } } }),
    ]);
    for (const response of responses) {
      assert.equal(response.status(), 403, response.url());
      assert.equal((await response.json()).error, "early", response.url());
    }
  }
  assert.equal(one("select count(*) n from messages where booking_id=?", id).n, messagesBefore);
  assert.equal(one("select count(*) n from attachments where booking_id=?", id).n, attachmentsBefore);
  console.log("PASS API: messages read/write, SSE, typing, and session upload reject both participants before start");

  // Use real wall time for the transition: a stale open list must enable entry without user reload.
  const start = Date.now() + 15_000;
  db.prepare("update bookings set start_at=?, end_at=? where id=?").run(start, start + booking.duration_min * 60_000, id);
  await Promise.all([a.goto(`${base}/me/bookings`), b.goto(`${base}/specialist/dashboard`)]);
  assert.ok(Date.now() < start, "both booking lists must load before fixture start");
  assert.equal(await aRow.getByRole("button", { name: "시작 전", exact: true }).isDisabled(), true);
  assert.equal(await bRow.getByRole("button", { name: "Not started", exact: true }).isDisabled(), true);
  const links = [aRow.locator(`a[href="/sessions/${id}"]`), bRow.locator(`a[href="/sessions/${id}"]`)];
  await Promise.all(links.map((link) => link.waitFor({ state: "visible", timeout: 25_000 })));
  assert.ok(Date.now() >= start, "entry cannot enable before the scheduled start");
  console.log("PASS clock transition: both booking lists automatically enable entry at the actual start time");

  await Promise.all(links.map((link) => link.click()));
  const input = 'form input[maxlength="2000"]';
  const send = 'form:has(input[maxlength="2000"]) button[type="submit"]';
  for (const page of [a, b]) {
    await page.waitForURL(`${base}/sessions/${id}`);
    await page.waitForFunction((selector) => document.querySelector(selector) && !document.querySelector(selector).disabled, input);
    await page.getByText("minjae.pdf", { exact: true }).waitFor();
    await page.locator("main").getByText(note, { exact: false }).waitFor();
  }
  await a.fill(input, "상담 시작 시간이 되어 입장했어요.");
  await a.click(send);
  await b.getByText("상담 시작 시간이 되어 입장했어요.", { exact: true }).waitFor();
  await b.fill(input, "네, 작성해 주신 기타 상담 목적을 함께 확인해 볼게요.");
  await b.click(send);
  await a.getByText("네, 작성해 주신 기타 상담 목적을 함께 확인해 볼게요.", { exact: true }).waitFor();
  await a.setInputFiles('input[type="file"]', "seed-assets/cv/seojun.pdf");
  await b.getByText("seojun.pdf", { exact: true }).waitFor();
  console.log("PASS active session: both roles enter, preparation file and custom purpose are available, live chat works both ways, and session upload succeeds");

  await a.getByRole("button", { name: "세션 종료", exact: true }).click();
  await a.getByRole("link", { name: "리뷰 남기기", exact: true }).waitFor();
  await b.waitForFunction((selector) => document.querySelector(selector)?.disabled, input);
  for (const page of [a, b]) {
    const history = await page.request.get(`${base}/api/bookings/${id}/messages`);
    assert.equal(history.status(), 200);
    assert.ok((await history.json()).messages.length >= 4);
  }
  assert.equal(one("select status from bookings where id=?", id).status, "completed");
  assert.deepEqual(failures, [], "no page errors or HTTP 500 responses");
  console.log("PASS completion: chat closes on both sides and completed transcripts remain readable");
  console.log(`Screenshots: ${output}`);
} finally {
  try { await browser?.close(); } finally { db.close(); }
}
