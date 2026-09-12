// Phone-width layout check: opens the mobile menu and reports any route whose document is wider than the viewport.
// Usage: node scripts/mobile-check.mjs <specialistId>  (dev server on :3000)
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
// open mobile menu, logged out
await page.goto(`${base}/`);
await page.click('button[aria-controls="mobile-menu"]');
await page.waitForSelector("#mobile-menu");
await page.screenshot({ path: ".impeccable/review/m-menu.png" });
// log in and check the profile page width
await page.goto(`${base}/login`);
await page.fill('input[name="email"]', "jiwoo@korea.ac.kr");
await page.fill('input[name="password"]', "hoobae1234");
await page.click('form button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"));
const seojun = process.argv[2];
await page.goto(`${base}/specialists/${seojun}`);
await page.waitForTimeout(800);
const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
console.log("profile scrollWidth vs viewport:", widths);
assert.ok(widths.doc <= widths.vw, "profile overflows the phone viewport");
const headerLabels = await page.locator('header a[aria-label="SunbaeHub · 선배허브"] > span, header button[aria-label="Switch to English"] > span').evaluateAll((els) =>
  els.filter((el) => el.getBoundingClientRect().width > 0).map((el) => ({ text: el.textContent, height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) })),
);
for (const label of headerLabels) assert.ok(label.height <= label.line * 1.2, `mobile header wraps: ${label.text}`);
console.log("PASS mobile header: visible brand and language labels stay on one line");
await page.screenshot({ path: ".impeccable/review/m-profile.png", fullPage: false });
// logged-in menu
await page.click('button[aria-controls="mobile-menu"]');
await page.waitForSelector("#mobile-menu");
await page.screenshot({ path: ".impeccable/review/m-menu-in.png" });
// check overflow on other key pages
for (const path of ["/", "/specialists", "/leaderboard", "/me/bookings", "/me/credits", "/posts", "/signup?role=expert"]) {
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(400);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`${path}: scrollWidth ${w}${w > 390 ? "  <-- OVERFLOW" : ""}`);
  assert.ok(w <= 390, `${path} overflows the phone viewport`);
}

await page.goto(`${base}/specialists`);
await page.click('button[aria-controls="mobile-menu"]');
await page.locator('#mobile-menu a[href="/specialists"]').click();
await page.locator("#mobile-menu").waitFor({ state: "hidden" });
console.log("PASS mobile menu: selecting the current page closes the menu");

const reduced = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
const landing = await reduced.newPage();
await landing.goto(base);
const hero = landing.getByTestId("landing-booking-card");
await hero.waitFor({ state: "visible" });
await landing.waitForFunction(() => {
  const el = document.querySelector('[data-testid="landing-booking-card"]');
  return el && getComputedStyle(el).opacity === "1" && getComputedStyle(el).transform === "none";
});
await landing.screenshot({ path: ".impeccable/review/reduced-motion-landing.png" });
console.log("PASS reduced motion: landing booking card is visible without animation");
await browser.close();
