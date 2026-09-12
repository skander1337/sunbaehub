// End-to-end check of the demo's centerpiece: two browsers chatting with live translation, and a real booking.
// Usage: npm run dev (in another terminal) then `node scripts/e2e-demo.mjs`. Re-run `npm run db:seed` afterwards to reset demo data.
import { chromium } from "playwright";
import Database from "better-sqlite3";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const db = new Database("dev.db", { readonly: true });
const jiwoo = db.prepare("select id, credit_balance as bal from users where email='jiwoo@korea.ac.kr'").get();
const seojun = db.prepare("select id from users where email='seojun@sunbae.demo'").get();
const live = db.prepare("select id from bookings where status in ('confirmed','in_progress') and seeker_id=? and specialist_id=? order by start_at asc limit 1").get(jiwoo.id, seojun.id);
if (!live) throw new Error("no live booking between 김지우 and 박서준; run npm run db:seed");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const mk = async (uid, locale) => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addCookies([
    { name: "sunbae_uid", value: uid, domain: "localhost", path: "/" },
    { name: "sunbae_locale", value: locale, domain: "localhost", path: "/" },
  ]);
  return c.newPage();
};
// 0) real login form: wrong password is rejected, right password lands on the directory
{
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await c.newPage();
  await p.goto(`${base}/login`);
  await p.fill('input[name="email"]', "jiwoo@korea.ac.kr");
  await p.fill('input[name="password"]', "wrong-password");
  await p.click('form button[type="submit"]');
  await p.waitForURL(/\/login\?error=credentials/, { timeout: 15_000 });
  await p.fill('input[name="email"]', "jiwoo@korea.ac.kr");
  await p.fill('input[name="password"]', "hoobae1234");
  await p.click('form button[type="submit"]');
  await p.waitForURL(/\/specialists$/, { timeout: 15_000 });
  const cookies = await c.cookies();
  if (!cookies.some((k) => k.name === "sunbae_uid")) throw new Error("session cookie not set after login");
  console.log("PASS login: wrong password rejected, correct password sets the session");
  await c.close();
}

const a = await mk(jiwoo.id, "ko"); // seeker, Korean UI
const b = await mk(seojun.id, "en"); // specialist, English UI
const input = 'form input[maxlength="2000"]';
const send = 'form:has(input[maxlength="2000"]) button[type="submit"]';

// 1) chat both ways with auto-translation
await a.goto(`${base}/sessions/${live.id}`);
await b.goto(`${base}/sessions/${live.id}`);
await a.fill(input, "감사합니다!");
await a.click(send);
await b.getByText("Thank you!", { exact: true }).waitFor({ timeout: 10_000 });
await b.fill(input, "Feel free to ask anything.");
await b.click(send);
await a.getByText("질문 있으면 편하게 물어보세요.", { exact: true }).waitFor({ timeout: 10_000 });
await a.screenshot({ path: ".impeccable/review/e2e-chat-seeker.png" });
await b.screenshot({ path: ".impeccable/review/e2e-chat-specialist.png" });
console.log("PASS chat: ko→en and en→ko translated across two browsers");

// 2) real booking through the slot picker
await a.goto(`${base}/specialists/${seojun.id}`);
const chip = a.locator('form:has(input[name="specialistId"]) button[aria-pressed="false"]').first(); // first open time slot
const slotLabel = await chip.textContent();
await chip.click();
await a.locator('form:has(input[name="specialistId"]) button[type="submit"]').click();
await a.waitForURL(/\/me\/bookings\?booked=/, { timeout: 15_000 });
const fresh = new Database("dev.db", { readonly: true }).prepare("select credit_balance as bal from users where id=?").get(jiwoo.id);
console.log(`PASS booking: slot ${slotLabel?.trim()} booked, balance ${jiwoo.bal} → ${fresh.bal}`);
await a.screenshot({ path: ".impeccable/review/e2e-booked.png", fullPage: false });

await browser.close();
