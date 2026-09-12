// Sunbae onboarding pipeline check: expert sign-up → profile + CV → pending → hidden publicly → admin approves → listed.
// Also: seeker sign-up with affiliation. Requires the dev server on :3000. Admin is authenticated by minting a DB session
// (dev-only shortcut so this check does not depend on the seeded admin email).
import { chromium } from "playwright";
import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const db = new Database("dev.db");
const stamp = Date.now();
const expertName = `테스트선배${stamp % 10000}`;
const expertEmail = `expert-${stamp}@sunbaehub.demo`;
const seekerEmail = `seeker-${stamp}@korea.ac.kr`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

// 1) expert sign-up → onboarding
await page.goto(`${base}/signup?role=expert`);
await page.fill('input[name="name"]', expertName);
await page.fill('input[name="email"]', expertEmail);
await page.fill('input[name="password"]', "testpass123");
await page.click('form button[type="submit"]');
await page.waitForURL(/\/specialist\/onboarding/, { timeout: 15_000 });
await page.screenshot({ path: ".impeccable/review/onboarding.png", fullPage: true });
console.log("PASS signup(expert): lands on onboarding");

// 2) complete the profile with a CV → pending
await page.fill('input[name="headline"]', "네이버 프론트엔드 개발자 4년");
await page.fill('textarea[name="bio"]', "네이버에서 프론트엔드를 개발하고 있어요. 포트폴리오와 코딩테스트 준비를 도와드려요.");
await page.fill('input[name="requestedRate"]', "150");
await page.locator('label:has(input[name="categories"][value="portfolio"])').click();
await page.fill('input[name="edu_school_0"]', "고려대학교");
await page.fill('input[name="edu_major_0"]', "컴퓨터학과");
await page.fill('input[name="exp_company_0"]', "네이버");
await page.fill('input[name="exp_title_0"]', "프론트엔드 개발자");
await page.setInputFiles('input[name="resume"]', "seed-assets/cv/seoyeon.pdf");
await page.click('form:has(input[name="headline"]) button[type="submit"]');
await page.waitForURL(/\/specialist\/dashboard\?submitted=1/, { timeout: 15_000 });
await page.getByText("운영팀이 프로필을 검토하고 있어요").waitFor({ timeout: 10_000 });
await page.screenshot({ path: ".impeccable/review/dashboard-pending.png", fullPage: true });
const row = db.prepare("select p.verification, p.resume_path from specialist_profiles p join users u on u.id=p.user_id where u.email=?").get(expertEmail);
if (row.verification !== "pending" || !row.resume_path) throw new Error(`expected pending with resume, got ${JSON.stringify(row)}`);
console.log("PASS onboarding: profile + CV saved, status pending");

// 3) not public while pending
await page.goto(`${base}/specialists`);
if ((await page.locator("main").getByText(expertName).count()) > 0) throw new Error("pending specialist is publicly listed");
console.log("PASS gating: pending specialist hidden from the directory");

// 4) admin approves with the review form
const admin = db.prepare("select id from users where is_admin = 1").get();
const tok = randomBytes(32).toString("base64url");
db.prepare("insert into sessions (id,user_id,created_at,expires_at) values (?,?,?,?)").run(createHash("sha256").update(tok).digest("hex"), admin.id, Date.now(), Date.now() + 3_600_000);
const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await actx.addCookies([{ name: "sunbae_session", value: tok, domain: "localhost", path: "/" }]);
const ap = await actx.newPage();
await ap.goto(`${base}/admin/verifications`);
await ap.getByText(expertName).waitFor({ timeout: 10_000 });
await ap.screenshot({ path: ".impeccable/review/admin-verifications.png", fullPage: true });
const card = ap.locator("li", { hasText: expertName });
await card.locator('input[name="baseRate"]').fill("120");
await card.locator('button[value="verified"]').click();
await ap.waitForURL(/\/admin\/verifications/, { timeout: 15_000 });
await ap.waitForTimeout(500);
if ((await ap.getByText(expertName).count()) > 0) throw new Error("approved specialist still in the queue");
console.log("PASS admin: approved from the verification queue");

// 5) now public, with the badge
await page.goto(`${base}/specialists`);
await page.locator("main").getByText(expertName).first().waitFor({ timeout: 10_000 });
await page.goto(`${base}/specialist/dashboard`);
await page.getByText("인증됨").waitFor({ timeout: 10_000 });
const rate = db.prepare("select p.base_price as base, p.requested_rate as req from specialist_profiles p join users u on u.id=p.user_id where u.email=?").get(expertEmail);
if (rate.base !== 120) throw new Error(`admin base rate not applied: ${JSON.stringify(rate)}`);
console.log(`PASS listing: approved specialist is public with the admin-set base rate ${rate.base} (requested ${rate.req})`);

// 6) seeker sign-up with affiliation
const sp = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await sp.goto(`${base}/signup`);
await sp.fill('input[name="name"]', "테스트후배");
await sp.fill('input[name="email"]', seekerEmail);
await sp.fill('input[name="password"]', "testpass123");
await sp.fill('input[name="affiliation"]', "고려대학교 경제학과 3학년");
await sp.click('form button[type="submit"]');
await sp.waitForURL(/\/specialists$/, { timeout: 15_000 });
const seeker = db.prepare("select affiliation, credit_balance as bal from users where email=?").get(seekerEmail);
if (seeker.affiliation !== "고려대학교 경제학과 3학년" || seeker.bal !== 70) throw new Error(`seeker row wrong: ${JSON.stringify(seeker)}`);
console.log("PASS signup(seeker): affiliation stored, 70 welcome credits (one 30-minute session), lands on the directory");

await browser.close();
