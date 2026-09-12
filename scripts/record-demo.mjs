// Record the real application with synthetic users in a disposable, seeded checkout.
// BASE_URL must point to that checkout's dev server. Never run against the recording/user database.
import { chromium } from "playwright";
import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { recordOnboarding } from "./recording/onboarding.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3107";
assert.equal(process.env.RECORDING_DATABASE_IS_DISPOSABLE, "1", "Set RECORDING_DATABASE_IS_DISPOSABLE=1 only in an isolated, freshly seeded copy");
const outputDir = path.resolve(process.env.RECORDING_OUTPUT ?? "recordings/judges-slow-demo");
const viewport = { width: 1600, height: 900 };
const users = {
  seeker: { name: "김지민", email: "jimin.pitch@sunbaehub.demo", password: "PitchDemo2026!" },
  expert: { name: "박현우", email: "hyunwoo.pitch@sunbaehub.demo", password: "PitchDemo2026!" },
  admin: { email: "admin@sunbaehub.demo", password: "admin1234" },
};
const scenes = [];
const errors = [];
const typingEvents = [];
let sceneActive = false;
let cursorPosition = { x: 1300, y: 760 };
const maxScenes = process.env.RECORDING_MAX_SCENES ? Number(process.env.RECORDING_MAX_SCENES) : Infinity;
assert.ok(maxScenes === Infinity || (Number.isInteger(maxScenes) && maxScenes > 0), "RECORDING_MAX_SCENES must be a positive integer");
class RecordingComplete extends Error {}
const rawVideo = path.join(outputDir, "raw", "tour.webm");
mkdirSync(path.join(outputDir, "raw"), { recursive: true });
mkdirSync(path.join(outputDir, "fixtures"), { recursive: true });
const db = new Database("dev.db", { readonly: true });
assert.equal(db.prepare("select count(*) n from users where email=?").get(users.seeker.email).n, 0, "Use a freshly seeded disposable database");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--lang=ko-KR"] });
let context, page, partnerContext;
let videoStart = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const elapsed = () => (Date.now() - videoStart) / 1000;
const manifestPath = path.join(outputDir, "manifest.json");
function manifest() {
  writeFileSync(manifestPath, JSON.stringify({ rawVideo, viewport, scenes, outputDir, errors, typingEvents, pacing: "Real-time, character-by-character Korean typing; deliberate section tours and reading pauses" }, null, 2));
}
async function scrollTo(locator) {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    if (bounds.top < 100 || bounds.bottom > window.innerHeight - 90) {
      element.scrollIntoView({ behavior: "smooth", block: bounds.height > window.innerHeight - 190 ? "start" : "center", inline: "nearest" });
    }
  });
  await pause(sceneActive ? 750 : 120);
}
async function show(locator, milliseconds = 4500) {
  await scrollTo(locator);
  await pause(milliseconds);
}
async function point(locator) {
  await scrollTo(locator);
  const box = await locator.boundingBox();
  if (!box) return;
  const target = { x: box.x + Math.min(box.width * 0.5, 150), y: box.y + Math.min(box.height * 0.5, 28) };
  const steps = sceneActive ? 18 : 1;
  const origin = cursorPosition;
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const eased = t * t * (3 - 2 * t);
    await page.mouse.move(origin.x + (target.x - origin.x) * eased, origin.y + (target.y - origin.y) * eased);
    if (sceneActive) await pause(22);
  }
  cursorPosition = target;
}
async function type(locator, text) {
  await point(locator);
  const box = await locator.boundingBox();
  await locator.click({ position: { x: Math.min(box.width * 0.5, 150), y: Math.min(box.height * 0.5, 28) } });
  if (!sceneActive) { await locator.fill(text); return; }
  await pause(450);
  await locator.press("ControlOrMeta+A");
  await locator.press("Backspace");
  const start = elapsed();
  const characters = Array.from(text);
  for (let i = 0; i < characters.length; i++) {
    const character = characters[i];
    if (character === "\n") await locator.press("Enter");
    else await locator.pressSequentially(character);
    const jitter = ((i * 37 + characters.length * 11) % 83);
    await pause((/[가-힣]/.test(character) ? 170 : 90) + jitter);
    if (/[.!?\n]/.test(character)) await pause(400);
    else if (character === " " && i % 3 === 0) await pause(180);
  }
  assert.equal(await locator.inputValue(), text, "Typed value must match the intended input");
  typingEvents.push({ scene: scenes.length + 1, field: await locator.getAttribute("name"), characters: characters.length, start, end: elapsed() });
  await pause(1050);
}
async function click(locator) {
  await point(locator);
  await pause(sceneActive ? 750 : 100);
  await locator.click({ position: { x: Math.min((await locator.boundingBox()).width * 0.5, 150), y: Math.min((await locator.boundingBox()).height * 0.5, 28) } });
  await pause(sceneActive ? 1250 : 180);
}
async function go(route) {
  await page.goto(`${base}${route}`);
  await page.locator("main").waitFor();
  await pause(sceneActive ? 3500 : 500);
}
async function login(user) {
  await page.goto(`${base}/login`);
  await type(page.locator('input[name="email"]'), user.email);
  await type(page.locator('input[name="password"]'), user.password);
  await click(page.locator('main form button[type="submit"]'));
  await page.waitForURL((url) => url.pathname !== "/login");
  await page.locator("main").waitFor();
}
async function logout() {
  await page.locator("header").scrollIntoViewIfNeeded();
  await click(page.locator("header details > summary"));
  await click(page.getByRole("button", { name: "로그아웃", exact: true }));
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/login");
}
async function scene(title, caption, action, { minSeconds = 8 } = {}) {
  console.log(`RECORD ${scenes.length + 1}: ${title}`);
  await pause(500);
  const start = elapsed();
  sceneActive = true;
  try {
    await pause(2200);
    await action();
    await pause(Math.max(5500, Math.max(16, minSeconds) * 1000 - (elapsed() - start) * 1000));
  } finally { sceneActive = false; }
  const end = elapsed();
  scenes.push({ title, caption, start, end });
  await page.screenshot({ path: path.join(outputDir, `scene-${String(scenes.length).padStart(2, "0")}.png`) });
  manifest();
  if (errors.length) throw new Error(errors.join("\n"));
  if (scenes.length >= maxScenes) throw new RecordingComplete();
}
const field = (name) => page.locator(`[name="${name}"]`);
const button = (name) => page.getByRole("button", { name, exact: true });
const formBy = (name, id) => page.locator(`form:has(input[name="${name}"][value="${id}"])`);
const readBooking = (id) => db.prepare("select * from bookings where id=?").get(id);

async function fixtures() {
  const ctx = await browser.newContext({ locale: "ko-KR" });
  const p = await ctx.newPage();
  const wrap = (title, body) => `<!doctype html><html><head><style>@page{size:A4;margin:22mm}body{font-family:"Apple SD Gothic Neo",sans-serif;color:#191f28;line-height:1.6}h1{font-size:30px;margin-bottom:3px}h2{color:#2b44a8;font-size:17px;margin-top:25px}p,li{font-size:13px}.note{color:#667085;font-size:11px;border-top:1px solid #ddd;padding-top:15px;margin-top:30px}</style></head><body><h1>${title}</h1>${body}<p class="note">가상 자료 · 선배허브 해커톤 시연용입니다. 인물, 경력, 프로젝트는 모두 가상으로 작성했습니다.</p></body></html>`;
  const cvPath = path.join(outputDir, "fixtures", "박현우-이력서.pdf");
  await p.setContent(wrap("박현우", `<p>프로덕트 디자이너 · 포트폴리오와 면접 코칭</p><p>${users.expert.email}</p><h2>소개</h2><p>신입 디자이너의 프로젝트를 설득력 있는 사례로 정리하고, 자신 있게 면접을 준비하도록 도와드립니다.</p><h2>경력</h2><b>서울 디자인 스튜디오 · 시니어 프로덕트 디자이너</b><p>2019–현재</p><ul><li>문제 정의와 디자인 의사결정을 중심으로 프로젝트 사례를 정리합니다.</li><li>포트폴리오 구성과 면접 답변을 함께 준비합니다.</li></ul><h2>학력</h2><b>홍익대학교</b><p>시각디자인학과 학사 · 2015–2019</p><h2>상담 분야</h2><p>포트폴리오 검토 · 면접 코칭</p>`));
  await p.pdf({ path: cvPath, format: "A4", printBackground: true });
  const portfolioPath = path.join(outputDir, "fixtures", "김지민-포트폴리오.pdf");
  await p.setContent(wrap("김지민 · 포트폴리오 초안", `<p>취업 준비 · 피드백을 위한 프로젝트 사례</p><h2>대학생 진로 상담 서비스</h2><p>졸업을 앞둔 대학생이 실질적인 진로 조언을 얻는 과정을 살펴본 프로젝트입니다.</p><h2>문제 정의</h2><p>조언이 커뮤니티 글과 채용 공고, 개인 메시지에 흩어져 있습니다. 학생에게는 실행할 수 있는 다음 단계가 필요합니다.</p><h2>해결 방향</h2><ul><li>전문가 탐색부터 상담 예약과 준비까지의 흐름을 정리합니다.</li><li>예약 전에 시간과 가격, 기대할 수 있는 결과를 안내합니다.</li><li>구체적인 피드백으로 지원서 초안을 개선합니다.</li></ul><h2>선배에게 묻고 싶은 점</h2><p>도입부가 명확한가요? 어떤 내용을 먼저 보여줘야 할까요? 면접에서 디자인 의사결정을 어떻게 설명하면 좋을까요?</p>`));
  await p.pdf({ path: portfolioPath, format: "A4", printBackground: true });
  await ctx.close();
  return { cvPath, portfolioPath };
}

try {
  const { cvPath, portfolioPath } = await fixtures();
  context = await browser.newContext({ locale: "ko-KR", viewport, deviceScaleFactor: 1, recordVideo: { dir: path.join(outputDir, "raw"), size: viewport } });
  context.setDefaultTimeout(20_000);
  await context.addCookies([{ name: "sunbae_locale", value: "ko", url: base }]);
  await context.addInitScript(() => {
    const install = () => {
      const cursor = document.createElement("div");
      cursor.setAttribute("aria-hidden", "true");
      cursor.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:24px;height:30px;display:none;filter:drop-shadow(0 1px 2px #0008)";
      cursor.innerHTML = '<svg width="24" height="30" viewBox="0 0 24 30"><path d="M3 2v23l6-6 5 10 4-2-5-10h9Z" fill="#172b4d" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.documentElement.append(cursor);
      document.addEventListener("mousemove", (event) => {
        cursor.style.display = "block";
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      }, { passive: true });
      document.addEventListener("mousedown", (event) => {
        const ring = document.createElement("div");
        ring.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:${event.clientX - 16}px;top:${event.clientY - 16}px;width:32px;height:32px;border:2px solid #435ac9;border-radius:50%;background:#435ac91a`;
        document.documentElement.append(ring);
        const animation = ring.animate([{ transform: "scale(.55)", opacity: .8 }, { transform: "scale(1.35)", opacity: 0 }], { duration: 550 });
        animation.onfinish = () => ring.remove();
      }, { passive: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  });
  videoStart = Date.now();
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base);
  await pause(2300);
  await scene("선배허브", "검증된 선배와의 1:1 상담, 예약부터 정산까지 한곳에서 시작합니다.", async () => {
    await pause(2000);
    await page.locator("h1").waitFor();
  }, { minSeconds: 8 });

  const { expertId } = await recordOnboarding({ page, scene, pause, show, type, click, login, logout, db, base, cvPath, users });

  await go("/specialist/posts/new");
  await scene("선배 · 경험을 글로 나누기", "인증 선배는 글을 게시하고, 적립 조건을 충족한 독자의 하루 첫 열람으로 1크레딧을 받습니다.", async () => {
    await type(field("title"), "포트폴리오 이야기를 명확하게 만드는 세 가지 방법");
    await type(field("body"), "해결한 문제부터 이야기하세요.\n\n중요한 디자인 의사결정 하나와 그 이유를 설명하세요.\n\n배운 점과 다음에 개선할 점으로 마무리하세요. 상담에 초안을 가져오시면 함께 다듬어 드립니다.");
    await click(page.locator('main form button[type="submit"]'));
    await page.waitForURL(/\/posts\/[^/?]+\?published=/);
    await show(page.locator("main article"), 6500);
  }, { minSeconds: 12 });
  const postId = db.prepare("select id from posts where author_id=? order by created_at desc limit 1").get(expertId).id;

  await logout(); await login(users.seeker);
  await go("/specialists");
  await scene("후배 · 나에게 맞는 선배 찾기", "상담 분야를 고르고 경력과 학력을 확인한 뒤, 선배가 쓴 글을 읽어봅니다.", async () => {
    await click(page.locator('nav[aria-label="Category filter"] a[href="/specialists?category=portfolio"]'));
    await click(page.locator(`main a[href="/specialists/${expertId}"]`).first());
    await show(page.locator("main h1"), 5000);
    await show(page.locator("section").filter({ has: page.getByRole("heading", { name: "소개", level: 2, exact: true }) }), 5500);
    await show(page.locator("section").filter({ has: page.getByRole("heading", { name: "학력", level: 2, exact: true }) }), 5000);
    await show(page.locator("section").filter({ has: page.getByRole("heading", { name: "경력", level: 2, exact: true }) }), 5000);
    await show(page.locator(`main a[href="/posts/${postId}"]`), 3000);
    await click(page.locator(`main a[href="/posts/${postId}"]`));
    for (let retry = 0; retry < 20; retry++) {
      if (db.prepare("select credit_balance n from users where id=?").get(expertId).n === 1) break;
      await pause(500);
    }
    await show(page.locator("main article"), 7000);
  }, { minSeconds: 12 });
  assert.equal(db.prepare("select credit_balance n from users where id=?").get(expertId).n, 1);

  await go("/me/credits");
  await scene("후배 · 크레딧 충전과 거래 내역", "가입하면 70크레딧을 받습니다. 시연에서는 실제 결제 없이 충전됩니다.", async () => {
    await show(page.getByText("보유 크레딧", { exact: true }), 5000);
    await click(page.locator('label:has(input[name="amount"][value="1000"])'));
    await click(page.locator('label:has(input[name="method"][value="toss"])'));
    await pause(4000);
    await click(button("충전하기"));
    await page.waitForURL(/\/me\/credits\?topped=1000/);
    await show(page.getByText("보유 크레딧", { exact: true }), 4500);
    await show(page.locator("section").filter({ has: page.getByRole("heading", { name: "거래 내역", exact: true }) }), 6000);
  }, { minSeconds: 11 });

  async function book({ attach = false, daysAhead = 0 } = {}) {
    await go(`/specialists/${expertId}`);
    const bookingForm = page.locator('form:has(input[name="specialistId"])');
    await show(page.getByRole("button", { name: /^30분/ }), 2500);
    await click(page.getByRole("button", { name: /^30분/ }));
    if (daysAhead) await click(page.locator('button[role="tab"]').nth(daysAhead));
    await click(page.locator('form button.tnum[aria-pressed="false"]').first());
    await show(bookingForm.locator('button.tnum[aria-pressed="true"]'), 3500);
    await click(bookingForm.getByRole("button", { name: "포트폴리오 리뷰", exact: true }));
    if (attach) {
      await type(field("note"), "포트폴리오 도입부와 디자인 의사결정 설명을 개선하고 싶어요.");
      await show(field("note"), 3500);
      await field("attachment").setInputFiles(portfolioPath);
      await show(page.getByText("김지민-포트폴리오.pdf", { exact: true }), 4500);
    }
    await show(bookingForm.locator(".hairline"), 5500);
    await click(page.locator('form:has(input[name="specialistId"]) button[type="submit"]'));
    await page.waitForURL(/\/me\/bookings\?booked=/);
    return new URL(page.url()).searchParams.get("booked");
  }
  let bookingId;
  await scene("후배 · 30분 상담 예약", "시간과 분야를 고르고 질문과 포트폴리오를 첨부해 상담을 예약합니다.", async () => {
    bookingId = await book({ attach: true });
    assert.equal(readBooking(bookingId).price, 120);
  }, { minSeconds: 18 });
  await scene("후배 · 예약 완료", "120크레딧이 보관됩니다. 선배는 상담 전에 질문과 첨부 자료를 확인할 수 있습니다.", async () => {
    await show(page.locator(`main li`).filter({ has: page.locator(`a[href="/sessions/${bookingId}"]`) }), 5500);
    await click(page.locator(`a[href="/sessions/${bookingId}"]`));
    await page.getByText("김지민-포트폴리오.pdf", { exact: true }).waitFor();
    await show(page.getByText("김지민-포트폴리오.pdf", { exact: true }), 4500);
  }, { minSeconds: 8 });

  await logout(); await login(users.expert);
  await scene("선배 · 새로운 예약 확인", "알림과 대시보드에서 후배, 상담 시간, 질문과 첨부 자료를 확인합니다.", async () => {
    await go("/me/notifications"); await pause(5000);
    await go("/specialist/dashboard"); await show(page.locator("main dl"), 4500);
    await show(page.locator(`main li`).filter({ has: page.locator(`a[href="/sessions/${bookingId}"]`) }), 6000);
    await click(page.locator(`a[href="/sessions/${bookingId}"]`));
    await page.getByText("김지민-포트폴리오.pdf", { exact: true }).waitFor();
    await show(page.getByText("포트폴리오 도입부와 디자인 의사결정 설명을 개선하고 싶어요.", { exact: false }), 5000);
  }, { minSeconds: 10 });
  await scene("시연 · 상담 시간 이동", "녹화를 위해 개발 모드의 시간 이동 기능으로 예약된 상담을 바로 시작합니다.", async () => {
    const start = button("데모: 지금 시작");
    await show(start, 4500);
    if (await start.isVisible()) await click(start);
    await page.waitForFunction(() => { const input = document.querySelector('input[maxlength="2000"]'); return input && !input.disabled; });
    await show(page.locator("main h1"), 4000);
  }, { minSeconds: 6 });

  // A second authenticated browser really sends the other side's messages.
  partnerContext = await browser.newContext({ viewport, locale: "ko-KR" });
  await partnerContext.addCookies([{ name: "sunbae_locale", value: "ko", url: base }]);
  const partner = await partnerContext.newPage();
  await partner.goto(`${base}/login`);
  await partner.locator('input[name="email"]').fill(users.expert.email);
  await partner.locator('input[name="password"]').fill(users.expert.password);
  await partner.locator('main form button[type="submit"]').click();
  await partner.waitForURL((url) => url.pathname !== "/login");
  await partner.goto(`${base}/sessions/${bookingId}`);
  await logout(); await login(users.seeker); await go(`/sessions/${bookingId}`);
  const composer = (p) => p.locator('input[maxlength="2000"]');
  async function say(p, text) { await composer(p).pressSequentially(text, { delay: 110 }); await p.waitForTimeout(900); await p.getByRole("button", { name: "보내기", exact: true }).click(); }
  await scene("후배와 선배 · 실시간 상담", "서로 로그인한 두 브라우저가 실제 메시지를 주고받습니다. 준비된 영어 문장은 한국어로 자동 번역됩니다.", async () => {
    await type(composer(page), "오늘 자기소개서 첨삭 부탁드려요.");
    await click(button("보내기")); await pause(4000);
    await say(partner, "Start the first sentence with your conclusion.");
    await page.getByText("첫 문장은 결론부터 쓰는 게 좋아요.", { exact: true }).waitFor();
    await pause(5500);
    await page.getByText("자동 번역", { exact: false }).first().waitFor();
    await pause(2500);
    await type(composer(page), "감사합니다! 어떤 부분을 고쳐야 할지 알겠어요.");
    await click(button("보내기"));
    await pause(4500);
  }, { minSeconds: 20 });
  await scene("후배와 선배 · 파일 공유와 통화 화면", "상담 중 파일을 공유합니다. 통화 화면은 타이머만 동작하는 데모이며 음성·영상 연결은 준비 중입니다.", async () => {
    await partner.locator('input[type="file"]').setInputFiles(cvPath);
    await page.getByText("박현우-이력서.pdf", { exact: true }).waitFor();
    await show(page.getByText("박현우-이력서.pdf", { exact: true }), 5500);
    await click(button("통화")); await pause(6000);
    await click(button("음소거")); await pause(3500);
    await click(button("통화 종료"));
  }, { minSeconds: 12 });
  await partnerContext.close(); partnerContext = null;

  await scene("후배 · 상담 종료와 리뷰", "상담을 마치고 점수와 리뷰를 남깁니다. 리뷰를 등록하면 정산이 확정됩니다.", async () => {
    await click(button("세션 종료"));
    await pause(4500);
    await click(page.getByRole("link", { name: "리뷰 남기기", exact: true }));
    await show(page.locator("main h1"), 4000);
    const score = page.locator('input[type="range"]');
    await point(score);
    await score.focus();
    await score.press("Home");
    for (let value = 0; value < 92; value++) { await score.press("ArrowRight"); await pause(35); }
    await pause(4000);
    await type(field("body"), "도입부와 구성에 대한 구체적인 피드백이 도움이 됐어요. 다음에 개선할 부분을 명확하게 알게 됐습니다.");
    await show(page.locator('main form:has(input[name="bookingId"])'), 5500);
    await click(button("리뷰 등록"));
    await page.waitForURL(/\/me\/bookings\?reviewed=/);
  }, { minSeconds: 14 });
  await scene("후배 · 상담 확인서", "완료한 상담의 참여자, 분야와 점수를 확인하고 상담 확인서를 인쇄할 수 있습니다.", async () => {
    await click(page.locator(`a[href="/sessions/${bookingId}/certificate"]`));
    await page.getByRole("heading", { name: "상담 확인서", level: 1 }).waitFor();
    await show(page.locator("article"), 8000);
  }, { minSeconds: 8 });
  await scene("리뷰, 상담 가격과 리더보드", "새 리뷰가 프로필에 반영됩니다. 공개 리뷰가 3개 이상인 선배는 리더보드에 참여합니다.", async () => {
    await go(`/specialists/${expertId}`); await show(page.locator("main dl"), 5000);
    await show(page.locator("section").filter({ has: page.getByRole("heading", { name: /^리뷰\s*\d+$/, level: 2 }) }), 6500);
    await go("/leaderboard"); await show(page.locator("main table"), 6000);
    await show(page.locator(`main a[href="/specialists/${expertId}"]`), 5500);
  }, { minSeconds: 10 });

  let cancellationId;
  await scene("추가 시나리오 · 예약 취소", "상담 시작까지 24시간 넘게 남은 예약을 취소하면 보관된 크레딧이 전액 환불됩니다.", async () => {
    cancellationId = await book({ daysAhead: 3 });
    const details = page.locator(`details:has(input[name="bookingId"][value="${cancellationId}"])`);
    await click(details.locator("summary")); await show(details, 6000);
    await click(details.locator('button[type="submit"]'));
    await page.waitForURL(/cancelled=1/);
    assert.equal(readBooking(cancellationId).status, "cancelled");
    await go("/me/credits");
    await show(page.locator("main li").filter({ hasText: "예약 취소 환불" }).first(), 6000);
  }, { minSeconds: 14 });

  let disputedBookingId;
  await scene("추가 시나리오 · 환불 요청", "별도의 완료된 상담으로 환불을 시연합니다. 환불 요청은 리뷰를 남기기 전에 할 수 있습니다.", async () => {
    disputedBookingId = await book({ daysAhead: 2 });
    await go(`/sessions/${disputedBookingId}`);
    await click(button("데모: 지금 종료"));
    await go("/me/bookings");
    const details = page.locator(`details:has(input[name="bookingId"][value="${disputedBookingId}"])`);
    await click(details.locator("summary"));
    await show(details, 4500);
    await type(details.locator('textarea[name="reason"]'), "시연용 환불 요청: 포트폴리오에 대한 구체적인 피드백이 부족했습니다. 상담 내용을 검토해 주세요.");
    await show(details, 4500);
    await click(details.locator('button[type="submit"]'));
    await page.waitForURL(/disputed=/);
  }, { minSeconds: 17 });
  await logout(); await login(users.admin); await go("/admin/disputes");
  const dispute = db.prepare("select id from disputes where booking_id=?").get(disputedBookingId);
  await scene("관리자 · 환불 검토와 승인", "관리자가 환불을 검토합니다. 후배 환불액, 선배 정산액과 수수료를 확인하고 결정합니다.", async () => {
    const form = formBy("disputeId", dispute.id);
    await show(page.locator("main li").filter({ has: form }), 7500);
    await type(form.locator('input[name="note"]'), "추가 시연 시나리오의 환불 요청을 승인합니다.");
    await pause(3500);
    await click(form.locator('button[value="approved"]'));
    await form.waitFor({ state: "detached" });
    const done = page.locator("main details");
    await click(done.locator("summary"));
    await show(done.locator("li").filter({ hasText: "김지민 → 박현우" }), 7500);
  }, { minSeconds: 10 });

  await go("/admin");
  await scene("관리자 · 의심 리뷰 검토", "규칙에 따라 의심 리뷰를 표시합니다. 관리자는 근거를 살펴보고 기각하거나 조작으로 확정합니다.", async () => {
    await show(page.locator("main").getByText("리뷰 전체 스캔", { exact: true }).first(), 5500);
    await click(button("리뷰 전체 스캔")); await page.waitForURL(/scanned=/);
    await pause(4500);
    await go("/admin/flags");
    const single = db.prepare("select f.id from review_flags f join reviews r on r.id=f.review_id where f.status='open' and r.status='flagged' and (select count(*) from review_flags x where x.review_id=r.id)=1 limit 1").get();
    const dismiss = formBy("flagId", single.id).filter({ has: page.locator('input[name="decision"][value="dismissed"]') });
    await show(page.locator("main li").filter({ has: dismiss }), 8000);
    await click(dismiss.locator("button")); await dismiss.waitFor({ state: "detached" });
    const open = db.prepare("select id from review_flags where status='open' limit 1").get();
    const confirm = formBy("flagId", open.id).filter({ has: page.locator('input[name="decision"][value="confirmed"]') });
    await show(page.locator("main li").filter({ has: confirm }), 8000);
    await click(confirm.locator("button")); await confirm.waitFor({ state: "detached" });
    await click(page.locator("main details summary"));
    await show(page.locator("main details"), 6500);
  }, { minSeconds: 15 });

  await go("/admin/specialists");
  await scene("관리자 · 선배 기본가 관리", "운영팀이 선배의 기본가를 관리하고, 리뷰에 따른 상담 가격을 함께 확인합니다.", async () => {
    const form = formBy("userId", expertId);
    await show(form, 5000);
    await type(form.locator('input[name="baseRate"]'), "250");
    await pause(3500);
    await click(form.locator('button[type="submit"]'));
    await page.waitForURL(/saved=/);
  }, { minSeconds: 8 });

  await logout(); await login(users.expert); await go("/specialist/earnings");
  await scene("선배 · 수익 확인과 출금 신청", "상담과 글에서 얻은 수익을 확인하고 100크레딧 출금을 신청합니다. 실제 송금은 이루어지지 않습니다.", async () => {
    await show(page.locator("main .grid").first(), 6500);
    await type(field("amount"), "100");
    await type(field("bankInfo"), "시연은행 0000 · 가상 계좌");
    await pause(4500);
    await click(button("출금 신청하기"));
    await page.waitForURL(/requested=1/);
    await show(page.getByRole("heading", { name: "출금 내역", exact: true }), 5500);
  }, { minSeconds: 12 });
  const withdrawal = db.prepare("select id from withdrawal_requests where user_id=? order by created_at desc limit 1").get(expertId);
  await logout(); await login(users.admin); await go("/admin/withdrawals");
  await scene("관리자 · 출금 지급 처리", "출금 대기 목록에서 지급 완료로 처리합니다. 이번 시연에서는 실제 돈이 이동하지 않습니다.", async () => {
    const form = formBy("withdrawalId", withdrawal.id);
    await show(page.locator("main li").filter({ has: form }), 7500);
    await click(form.locator('button[value="paid"]'));
    await form.waitFor({ state: "detached" });
    await click(page.locator("main details summary"));
    await show(page.locator("main details li").filter({ hasText: "박현우" }), 6000);
  }, { minSeconds: 8 });
  await logout(); await login(users.expert);
  await scene("선배 · 알림과 출금 내역", "리뷰 도착, 기본가 변경, 환불 결과와 출금 상태를 알림과 내역에서 확인합니다.", async () => {
    await go("/me/notifications"); await pause(7000);
    await go("/specialist/earnings");
    await show(page.getByRole("heading", { name: "출금 내역", exact: true }), 7000);
  }, { minSeconds: 9 });
  await logout(); await login(users.seeker);
  await scene("후배 · 환불과 거래 내역", "예약 보관, 취소 환불과 승인된 환불이 크레딧 거래 내역에 기록됩니다.", async () => {
    await go("/me/credits"); await show(page.locator("section").filter({ has: page.getByRole("heading", { name: "거래 내역", exact: true }) }), 7500);
    await go("/me/notifications"); await pause(5500);
  }, { minSeconds: 8 });
  await page.goto(base); await pause(1800);
  await scene("선배허브 · 전체 기능 시연", "가상 계정으로 시연했습니다. 결제·출금은 모의 처리, 번역은 준비된 문장, 통화는 타이머 데모입니다.", async () => pause(2000), { minSeconds: 7 });
  assert.equal(db.prepare("select status from withdrawal_requests where id=?").get(withdrawal.id).status, "paid");
  console.log(`Completed ${scenes.length} scenes, ${Math.round(scenes.reduce((sum, s) => sum + s.end - s.start, 0))} edited seconds`);
} catch (error) {
  if (error instanceof RecordingComplete) console.log(`Completed requested pickup: ${scenes.length} scenes`);
  else {
    errors.push(String(error));
    if (page) await page.screenshot({ path: path.join(outputDir, "failure.png"), fullPage: true }).catch(() => {});
    console.error(error);
    process.exitCode = 1;
  }
} finally {
  await partnerContext?.close();
  const video = page?.video();
  await context?.close();
  if (video) await video.saveAs(rawVideo);
  manifest();
  await browser.close();
  db.close();
}
