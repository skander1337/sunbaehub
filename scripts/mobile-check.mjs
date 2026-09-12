// Phone-width layout check: opens the mobile menu and reports any route whose document is wider than the viewport.
// Usage: node scripts/mobile-check.mjs <specialistId>  (dev server on :3000)
import { chromium } from "playwright";
const base = "http://localhost:3000";
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
}
await browser.close();
