// End-to-end check of the demo's centerpiece. Requires `npm run dev` on localhost:3000 (development mode: it uses the
// dev-only "start now" control). Run `npm run db:seed` afterwards to reset demo data.
import { chromium } from "playwright";
import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
mkdirSync(".impeccable/review", { recursive: true });
const db = new Database("dev.db", { readonly: true });
const jiwoo = db.prepare("select id, credit_balance as bal from users where email='jiwoo@korea.ac.kr'").get();
const seojun = db.prepare("select id from users where email='seojun@sunbaehub.demo'").get();
const input = 'form input[maxlength="2000"]';
const send = 'form:has(input[maxlength="2000"]) button[type="submit"]';
const bookingForm = 'form:has(input[name="specialistId"])';

const browser = await chromium.launch({ channel: "chrome", headless: true });
const mk = async (email, password, locale) => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addCookies([{ name: "sunbae_locale", value: locale, domain: "localhost", path: "/" }]);
  const p = await c.newPage();
  await p.goto(`${base}/login`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', password);
  await p.click('form button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
  return p;
};

// 0) login form: wrong password rejected, right password accepted
{
  const c = await browser.newContext();
  const p = await c.newPage();
  await p.goto(`${base}/login`);
  await p.fill('input[name="email"]', "jiwoo@korea.ac.kr");
  await p.fill('input[name="password"]', "wrong-password");
  await p.click('form button[type="submit"]');
  await p.waitForURL(/\/login\?error=credentials/, { timeout: 15_000 });
  await c.close();
  console.log("PASS login: wrong password rejected");
}

const a = await mk("jiwoo@korea.ac.kr", "hoobae1234", "ko"); // seeker, Korean UI
const b = await mk("seojun@sunbaehub.demo", "sunbae1234", "en"); // specialist, English UI

// 1) book a session with a cover letter attached
await a.goto(`${base}/specialists/${seojun.id}`);
const chip = a.locator(`${bookingForm} button.tnum[aria-pressed="false"]`).first(); // first open time chip
const slotLabel = (await chip.textContent())?.trim();
await chip.click();
await a.setInputFiles('input[name="attachment"]', "seed-assets/cv/minjae.pdf");
await a.locator(`${bookingForm} button[type="submit"]`).click();
await a.waitForURL(/\/me\/bookings\?booked=/, { timeout: 15_000 });
const bookedId = new URL(a.url()).searchParams.get("booked");
let shortBookingId;
const afterBooking = new Database("dev.db", { readonly: true }).prepare("select credit_balance as bal from users where id=?").get(jiwoo.id);
console.log(`PASS booking: slot ${slotLabel} booked with attachment, balance ${jiwoo.bal} → ${afterBooking.bal}`);

// 1b) a 30-minute booking costs half and holds exactly that
{
  await a.goto(`${base}/specialists/${seojun.id}`);
  const before = new Database("dev.db", { readonly: true }).prepare("select credit_balance as bal from users where id=?").get(jiwoo.id).bal;
  const price60 = new Database("dev.db", { readonly: true }).prepare("select price from bookings where id=?").get(bookedId).price;
  await a.getByRole("button", { name: /^30분/ }).click();
  const chip30 = a.locator(`${bookingForm} button.tnum[aria-pressed="false"]`).first();
  await chip30.click();
  await a.locator(`${bookingForm} button[type="submit"]`).click();
  await a.waitForURL(/\/me\/bookings\?booked=/, { timeout: 15_000 });
  const id30 = new URL(a.url()).searchParams.get("booked");
  shortBookingId = id30;
  const b30 = new Database("dev.db", { readonly: true }).prepare("select duration_min as d, price, (end_at - start_at) as ms from bookings where id=?").get(id30);
  const after = new Database("dev.db", { readonly: true }).prepare("select credit_balance as bal from users where id=?").get(jiwoo.id).bal;
  const expected = Math.max(5, Math.round((price60 * 30) / 60 / 5) * 5);
  if (b30.d !== 30 || b30.ms !== 30 * 60_000 || b30.price !== expected || before - after !== expected) throw new Error(`30-min booking wrong: ${JSON.stringify({ b30, before, after, expected })}`);
  console.log(`PASS 30-minute booking: ${b30.price} credits (60-min price ${price60}), window is 30 minutes`);
}

// 2) the attachment is visible in the room before the session starts; then open the window (dev-only control)
await a.goto(`${base}/sessions/${bookedId}`);
await a.getByText("minjae.pdf", { exact: true }).waitFor({ timeout: 10_000 });
console.log("PASS booking attachment: visible in the room before the session");
await a.getByRole("button", { name: "데모: 지금 시작" }).click();
await a.waitForFunction((sel) => { const el = document.querySelector(sel); return el && !el.disabled; }, input, { timeout: 15_000 });
await b.goto(`${base}/sessions/${bookedId}`);
await b.waitForFunction((sel) => { const el = document.querySelector(sel); return el && !el.disabled; }, input, { timeout: 15_000 });

// 3) chat both ways with auto-translation
await a.fill(input, "감사합니다!");
await a.click(send);
await b.getByText("Thank you!", { exact: true }).waitFor({ timeout: 10_000 });
await b.fill(input, "Feel free to ask anything.");
await b.click(send);
await a.getByText("질문 있으면 편하게 물어보세요.", { exact: true }).waitFor({ timeout: 10_000 });
console.log("PASS chat: ko→en and en→ko translated across two browsers");

// 4) live delivery must beat the 2.5s polling fallback
{
  const marker = `LIVE-${Date.now()}`;
  const t0 = Date.now();
  await b.fill(input, marker);
  await b.click(send);
  await a.getByText(marker, { exact: true }).waitFor({ timeout: 10_000 });
  const ms = Date.now() - t0;
  if (ms > 2000) throw new Error(`delivery took ${ms}ms; server-sent events are not working`);
  console.log(`PASS live: delivered in ${ms}ms via server-sent events`);
}

// 5) file sharing inside the room
await a.setInputFiles('input[type="file"]', "seed-assets/cv/seojun.pdf");
await b.getByText("seojun.pdf", { exact: true }).waitFor({ timeout: 10_000 });
console.log("PASS attachment: PDF shared in the room and visible to the other side");
await a.screenshot({ path: ".impeccable/review/e2e-chat-seeker.png" });
await b.screenshot({ path: ".impeccable/review/e2e-chat-specialist.png" });

// 6) the other participant can actually open the uploaded PDF
const pdfHref = await b.getByRole("link", { name: /seojun\.pdf/ }).getAttribute("href");
const pdf = await b.request.get(`${base}${pdfHref}`);
assert.equal(pdf.status(), 200);
assert.match(pdf.headers()["content-type"], /application\/pdf/);
assert.equal((await pdf.body()).subarray(0, 5).toString(), "%PDF-");
console.log("PASS attachment download: participant receives the PDF bytes");

// 7) ending the session also closes the mock call on the other screen
await b.getByRole("button", { name: "Call", exact: true }).click();
await b.getByText("In call", { exact: false }).waitFor();
await a.getByRole("button", { name: "세션 종료", exact: true }).click();
await a.getByRole("link", { name: "리뷰 남기기", exact: true }).waitFor();
await b.getByText("In call", { exact: false }).waitFor({ state: "hidden", timeout: 10_000 });
assert.equal(await b.locator(input).isDisabled(), true);
console.log("PASS session end: both screens close chat and the mock call");

// 8) review settles once, refresh does not pay twice, and certificate opens directly
await a.getByRole("link", { name: "리뷰 남기기", exact: true }).click();
await a.locator('textarea[name="body"]').fill("면접 준비 방향을 구체적으로 잡을 수 있었어요. 감사합니다.");
await a.getByRole("button", { name: "리뷰 등록", exact: true }).click();
await a.waitForURL(/\/me\/bookings\?reviewed=/, { timeout: 15_000 });
await a.reload();
const settled = db.prepare("select price, settled_at from bookings where id=?").get(bookedId);
assert.ok(settled.settled_at);
const releases = db.prepare("select type, amount from credit_transactions where booking_id=? and type in ('booking_release','platform_fee')").all(bookedId);
assert.equal(releases.length, 2);
assert.equal(releases.reduce((n, r) => n + r.amount, 0), settled.price);
assert.equal(db.prepare("select count(*) as n from reviews where booking_id=?").get(bookedId).n, 1);
await a.locator(`a[href="/sessions/${bookedId}/certificate"]`).click();
await a.waitForURL(`${base}/sessions/${bookedId}/certificate`);
await a.getByRole("heading", { name: "상담 확인서", exact: true, level: 1 }).waitFor();
console.log("PASS review, single settlement, and direct certificate link");

// 9) the recording controls preserve a 30-minute booking and valid timestamps
await a.goto(`${base}/sessions/${shortBookingId}`);
await a.getByRole("button", { name: "데모: 지금 시작", exact: true }).click();
await a.waitForFunction((sel) => !document.querySelector(sel)?.disabled, input);
let short = db.prepare("select start_at, end_at from bookings where id=?").get(shortBookingId);
assert.equal(short.end_at - short.start_at, 30 * 60_000);
await a.getByRole("button", { name: "데모: 지금 종료", exact: true }).click();
await a.getByRole("link", { name: "리뷰 남기기", exact: true }).waitFor();
short = db.prepare("select start_at, end_at from bookings where id=?").get(shortBookingId);
assert.ok(short.end_at > short.start_at);
console.log("PASS demo time controls: 30-minute duration preserved; end stays after start");

await browser.close();
