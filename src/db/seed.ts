/* Demo seed for SunbaeHub. Run with: npm run db:seed (tsx). Rebuilds the whole database. */
import fs from "node:fs";
import path from "node:path";
import { db } from "./index";
import * as s from "./schema";
import { postTx } from "@/lib/services/ledger";
import { recomputeStats, runFraudScan } from "@/lib/services/review";
import { priceFor, priceNote } from "@/lib/rules/pricing";
import { normalSettlement } from "@/lib/rules/refund";
import { fromSeoul, seoulDayKey, seoulParts } from "@/lib/seoul";
import { DEMO_PHRASES, detectLang, translate } from "@/lib/translate";
import { hashPassword } from "@/lib/password";
import { DEMO_PASSWORDS } from "@/lib/demo";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const now = new Date();
const uuid = () => crypto.randomUUID();

// ---------- reset ----------
db.delete(s.notifications).run();
db.delete(s.withdrawalRequests).run();
db.delete(s.disputes).run();
db.delete(s.creditTransactions).run();
db.delete(s.postClicks).run();
db.delete(s.posts).run();
db.delete(s.reviewFlags).run();
db.delete(s.reviews).run();
db.delete(s.messages).run();
db.delete(s.bookings).run();
db.delete(s.availabilityRules).run();
db.delete(s.specialistProfiles).run();
db.delete(s.users).run();

// ---------- users ----------
type Rule = { dow: number[]; start: number; end: number };
const H = (h: number) => h * 60;

const platformId = uuid();
db.insert(s.users).values({ id: platformId, name: "SunbaeHub Platform", email: "platform@sunbaehub.demo", isSeeker: false, isPlatform: true, createdAt: new Date(now.getTime() - 120 * DAY) }).run();

const adminId = uuid();
db.insert(s.users).values({ id: adminId, name: "관리자", email: "admin@sunbaehub.demo", passwordHash: hashPassword(DEMO_PASSWORDS.admin), isSeeker: false, isAdmin: true, createdAt: new Date(now.getTime() - 120 * DAY) }).run();

type SeekerSpec = { key: string; name: string; email: string; createdAgoDays: number; topup?: number; affiliation?: string };
const seekerSpecs: SeekerSpec[] = [
  { key: "jiwoo", name: "김지우", email: "jiwoo@korea.ac.kr", createdAgoDays: 80, topup: 2000, affiliation: "고려대학교 경영학과 4학년" },
  { key: "seoyun", name: "이서윤", email: "seoyun@korea.ac.kr", createdAgoDays: 75, topup: 1500, affiliation: "고려대학교 미디어학부 졸업" },
  { key: "minjun", name: "박민준", email: "minjun@korea.ac.kr", createdAgoDays: 70, topup: 1500, affiliation: "고려대학교 컴퓨터학과 4학년" },
  { key: "jimin", name: "최지민", email: "jimin@korea.ac.kr", createdAgoDays: 65, topup: 1500, affiliation: "고려대학교 심리학과 3학년" },
  { key: "newbie", name: "신규유저", email: "new@korea.ac.kr", createdAgoDays: 1 },
];
const seekers: Record<string, string> = {};
for (const sp of seekerSpecs) {
  const id = uuid();
  const createdAt = new Date(now.getTime() - sp.createdAgoDays * DAY);
  db.insert(s.users).values({ id, name: sp.name, email: sp.email, passwordHash: hashPassword(DEMO_PASSWORDS.seeker), affiliation: sp.affiliation ?? null, createdAt }).run();
  postTx(db, { userId: id, type: "signup_grant", amount: 200, note: "가입 축하 크레딧", createdAt });
  if (sp.topup) postTx(db, { userId: id, type: "topup", amount: sp.topup, note: `크레딧 충전 (카카오페이)`, createdAt: new Date(createdAt.getTime() + HOUR) });
  seekers[sp.key] = id;
}

type SpecSpec = {
  key: string; name: string; email: string; headline: string; bio: string; categories: string[]; base: number;
  education: s.Education[]; experience: s.Experience[]; rules: Rule[]; verification: string; scores: number[];
};
const specSpecs: SpecSpec[] = [
  { key: "seojun", name: "박서준", email: "seojun@sunbaehub.demo", headline: "삼성전자 인사팀 5년, 면접관 경험 3년", bio: "삼성전자 인사팀에서 신입 공채 면접관으로 3년간 참여했어요. 서류에서 무엇을 보는지, 면접에서 무엇을 묻는지 실제 기준으로 알려드려요.", categories: ["interview", "gongchae"], base: 100,
    education: [{ school: "고려대학교", major: "경영학과", degree: "학사", years: "2014–2020" }], experience: [{ company: "삼성전자", title: "인사팀 채용 담당", years: "2020–현재" }],
    rules: [{ dow: [1, 2, 3, 4, 5], start: H(19), end: H(22) }, { dow: [0], start: H(14), end: H(17) }], verification: "verified", scores: [92, 85, 90, 88, 86, 91, 84, 89, 87, 90, 86, 88] },
  { key: "haeun", name: "김하은", email: "haeun@sunbaehub.demo", headline: "네이버 백엔드 개발자, 코딩테스트 출제 경험", bio: "네이버 검색 플랫폼 백엔드를 4년째 개발하고 있어요. 코딩테스트 출제와 채점을 해봤고, 포트폴리오에서 무엇이 눈에 띄는지 알려드려요.", categories: ["portfolio", "coding_test"], base: 150,
    education: [{ school: "고려대학교", major: "컴퓨터학과", degree: "학사", years: "2015–2021" }], experience: [{ company: "네이버", title: "백엔드 개발자", years: "2021–현재" }],
    rules: [{ dow: [2, 4], start: H(20), end: H(23) }, { dow: [6], start: H(10), end: H(14) }, { dow: [0], start: H(10), end: H(12) }], verification: "verified", scores: [96, 93, 95, 92, 94, 94] },
  { key: "doyun", name: "이도윤", email: "doyun@sunbaehub.demo", headline: "카카오 PM, 서비스 기획 이직 3회", bio: "제조업 → 스타트업 → 카카오로 이직하며 자소서와 포트폴리오를 수십 번 고쳤어요. 기획 직군 지원자의 서류를 봐드려요.", categories: ["resume", "career_change"], base: 120,
    education: [{ school: "고려대학교", major: "산업경영공학부", degree: "학사", years: "2012–2018" }], experience: [{ company: "카카오", title: "프로덕트 매니저", years: "2022–현재" }, { company: "LG CNS", title: "서비스 기획", years: "2018–2020" }],
    rules: [{ dow: [1, 3, 5], start: H(18), end: H(21) }], verification: "verified", scores: [84, 78, 82, 80, 81] },
  { key: "sua", name: "최수아", email: "sua@sunbaehub.demo", headline: "현대자동차 채용팀, 인적성 검사 운영", bio: "현대자동차 채용팀에서 공채 전형 운영과 인적성 검사를 담당하고 있어요. 전형 단계별로 무엇을 준비해야 하는지 알려드려요.", categories: ["gongchae", "aptitude"], base: 80,
    education: [{ school: "고려대학교", major: "심리학과", degree: "학사", years: "2013–2019" }], experience: [{ company: "현대자동차", title: "채용팀", years: "2019–현재" }],
    rules: [{ dow: [6, 0], start: H(9), end: H(13) }, { dow: [3], start: H(20), end: H(22) }], verification: "verified", scores: [92, 88, 91, 89] },
  { key: "minjae", name: "정민재", email: "minjae@sunbaehub.demo", headline: "토스 데이터 분석가, 통계학 석사", bio: "토스에서 데이터 분석을 하고 있어요. 분석 포트폴리오와 데이터 직군 이직을 도와드려요.", categories: ["portfolio", "career_change"], base: 130,
    education: [{ school: "고려대학교", major: "통계학과", degree: "석사", years: "2016–2022" }], experience: [{ company: "토스", title: "데이터 분석가", years: "2022–현재" }],
    rules: [{ dow: [1, 2, 3, 4], start: H(21), end: H(23) }], verification: "verified", scores: [100, 100] },
  { key: "yerin", name: "한예린", email: "yerin@sunbaehub.demo", headline: "쿠팡 마케팅, 前 LG전자", bio: "브랜드 마케팅 6년차예요. 마케팅 직군 자소서와 면접 답변을 함께 다듬어요.", categories: ["resume", "interview"], base: 90,
    education: [{ school: "고려대학교", major: "미디어학부", degree: "학사", years: "2011–2017" }], experience: [{ company: "쿠팡", title: "브랜드 마케팅", years: "2021–현재" }, { company: "LG전자", title: "마케팅", years: "2017–2021" }],
    rules: [{ dow: [3, 5], start: H(19), end: H(22) }, { dow: [0], start: H(14), end: H(18) }], verification: "verified", scores: [80, 72, 76] },
  { key: "taeyang", name: "오태양", email: "taeyang@sunbaehub.demo", headline: "스타트업 CTO, 개발자 채용 50회+", bio: "시리즈 B 스타트업 CTO예요. 개발자 채용을 50번 넘게 진행했어요. 이직과 포트폴리오를 봐드려요.", categories: ["career_change", "portfolio"], base: 200,
    education: [{ school: "고려대학교", major: "전기전자공학부", degree: "학사", years: "2009–2015" }], experience: [{ company: "스타트업 (시리즈 B)", title: "CTO", years: "2020–현재" }],
    rules: [{ dow: [6], start: H(10), end: H(16) }], verification: "verified", scores: [] },
  { key: "seoyeon", name: "윤서연", email: "seoyeon@sunbaehub.demo", headline: "삼성SDS 컨설턴트 3년", bio: "IT 컨설팅 직군 취업 준비를 도와드려요. 인적성과 공채 전형 경험을 나눠요.", categories: ["aptitude", "gongchae"], base: 70,
    education: [{ school: "고려대학교", major: "경제학과", degree: "학사", years: "2016–2022" }], experience: [{ company: "삼성SDS", title: "컨설턴트", years: "2023–현재" }],
    rules: [{ dow: [1, 2, 3, 4, 5], start: H(12), end: H(13) }, { dow: [1, 2, 3, 4, 5], start: H(20), end: H(22) }], verification: "pending", scores: [] },
];

const specialists: Record<string, string> = {};
const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const tinyPdf = (title: string) =>
  `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 60>>stream\nBT /F1 24 Tf 72 760 Td (${title} - demo resume) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`;

for (const sp of specSpecs) {
  const id = uuid();
  const createdAt = new Date(now.getTime() - 90 * DAY);
  db.insert(s.users).values({ id, name: sp.name, email: sp.email, passwordHash: hashPassword(DEMO_PASSWORDS.expert), isSpecialist: true, createdAt }).run();
  postTx(db, { userId: id, type: "signup_grant", amount: 200, note: "가입 축하 크레딧", createdAt });
  const resumePath = `uploads/${id}.pdf`;
  const cv = path.join(process.cwd(), "seed-assets", "cv", `${sp.key}.pdf`);
  if (fs.existsSync(cv)) fs.copyFileSync(cv, path.join(process.cwd(), resumePath));
  else fs.writeFileSync(path.join(process.cwd(), resumePath), tinyPdf(sp.key));
  db.insert(s.specialistProfiles).values({
    userId: id, headline: sp.headline, bio: sp.bio, categories: sp.categories, basePrice: sp.base,
    education: sp.education, experience: sp.experience, resumePath, verification: sp.verification,
    submittedAt: sp.verification === "pending" ? new Date(now.getTime() - 6 * HOUR) : new Date(now.getTime() - 85 * DAY),
  }).run();
  for (const r of sp.rules) for (const dow of r.dow) db.insert(s.availabilityRules).values({ specialistId: id, dayOfWeek: dow, startMinute: r.start, endMinute: r.end }).run();
  specialists[sp.key] = id;
}

// ---------- helpers ----------
const p = seoulParts(now);
/** Seoul instant `daysAgo` days back, walked further back until the weekday has a rule; returns the slot start. */
function pastSlot(rules: Rule[], daysAgo: number, slotIndex = 0): Date {
  for (let back = daysAgo; back < daysAgo + 14; back++) {
    const dayStart = fromSeoul(p.y, p.m, p.d - back, 0);
    const dow = seoulParts(dayStart).dow;
    const rule = rules.find((r) => r.dow.includes(dow));
    if (rule) {
      const slots = (rule.end - rule.start) / 60;
      const t = rule.start + 60 * (slotIndex % slots);
      return fromSeoul(p.y, p.m, p.d - back, t);
    }
  }
  return fromSeoul(p.y, p.m, p.d - daysAgo, H(19));
}
function futureSlot(rules: Rule[], daysAhead: number, slotIndex = 0): Date {
  for (let ahead = daysAhead; ahead < daysAhead + 14; ahead++) {
    const dayStart = fromSeoul(p.y, p.m, p.d + ahead, 0);
    const dow = seoulParts(dayStart).dow;
    const rule = rules.find((r) => r.dow.includes(dow));
    if (rule) {
      const slots = (rule.end - rule.start) / 60;
      return fromSeoul(p.y, p.m, p.d + ahead, rule.start + 60 * (slotIndex % slots));
    }
  }
  return fromSeoul(p.y, p.m, p.d + daysAhead, H(20));
}

const stats: Record<string, { n: number; sum: number }> = {};
function currentPrice(specKey: string, base: number) {
  const st = stats[specKey] ?? { n: 0, sum: 0 };
  return priceFor(base, st.n, st.n ? st.sum / st.n : 0);
}

const convoScripts: number[][] = [
  [0, 1, 17, 18, 20, 21, 9, 10],
  [1, 3, 24, 25, 27, 12, 13],
  [0, 2, 31, 32, 33, 9, 13],
  [1, 3, 37, 38, 39, 12, 10],
  [0, 3, 35, 36, 13, 12],
  [1, 2, 26, 27, 28, 29, 9, 12],
  [0, 1, 30, 22, 9, 13],
];
function addMessages(bookingId: string, seekerId: string, specialistId: string, startAt: Date, script: number[]) {
  script.forEach((idx, i) => {
    const [ko] = DEMO_PHRASES[idx];
    const senderId = i % 2 === 0 ? seekerId : specialistId;
    const lang = detectLang(ko);
    const tr = translate(ko, lang, lang === "ko" ? "en" : "ko");
    db.insert(s.messages).values({
      bookingId, senderId, kind: "text", body: ko, lang, translatedBody: tr.matched ? tr.text : null,
      createdAt: new Date(startAt.getTime() + (3 + i * 6) * MIN),
    }).run();
  });
}

type CompletedOpts = { seekerKey: string; specKey: string; category: string; startAt: Date; score: number; reviewBody: string; reviewDelayMin?: number; script?: number[]; countStats?: boolean; noMessages?: boolean };
function completedBooking(o: CompletedOpts) {
  const spec = specSpecs.find((x) => x.key === o.specKey)!;
  const seekerId = seekers[o.seekerKey] ?? specialists[o.seekerKey];
  const specialistId = specialists[o.specKey];
  const pb = currentPrice(o.specKey, spec.base);
  const endAt = new Date(o.startAt.getTime() + HOUR);
  const bookingId = uuid();
  const createdAt = new Date(o.startAt.getTime() - 2 * DAY);
  const reviewAt = new Date(endAt.getTime() + (o.reviewDelayMin ?? 45) * MIN);
  db.insert(s.bookings).values({
    id: bookingId, seekerId, specialistId, category: o.category, startAt: o.startAt, endAt, price: pb.price, priceNote: priceNote(pb, "ko"),
    status: "completed", completedAt: endAt, settledAt: reviewAt, createdAt,
  }).run();
  postTx(db, { userId: seekerId, type: "booking_hold", amount: -pb.price, bookingId, note: `${spec.name} 상담 예약`, createdAt });
  if (!o.noMessages) addMessages(bookingId, seekerId, specialistId, o.startAt, o.script ?? convoScripts[Math.floor(Math.random() * convoScripts.length)]);
  const { platformFee, specialistPayout } = normalSettlement(pb.price);
  postTx(db, { userId: specialistId, type: "booking_release", amount: specialistPayout, bookingId, note: "상담 완료 정산", createdAt: reviewAt });
  postTx(db, { userId: platformId, type: "platform_fee", amount: platformFee, bookingId, note: "플랫폼 수수료 5%", createdAt: reviewAt });
  db.insert(s.reviews).values({ id: uuid(), bookingId, reviewerId: seekerId, specialistId, score: o.score, body: o.reviewBody, status: "visible", createdAt: reviewAt }).run();
  if (o.countStats !== false) {
    const st = (stats[o.specKey] ??= { n: 0, sum: 0 });
    st.n += 1; st.sum += o.score;
  }
  return bookingId;
}

const reviewBodies = [
  "실제 면접관 시선으로 피드백을 받으니 무엇을 고쳐야 할지 명확해졌어요.",
  "제 자소서에서 약한 문단을 정확히 짚어주셨어요. 다음 세션도 예약했어요.",
  "질문에 솔직하게 답해주셔서 좋았어요. 시간이 조금 짧게 느껴졌어요.",
  "포트폴리오 구성을 완전히 다시 잡았어요. 강력 추천해요.",
  "친절하고 구체적이었어요. 기대보다 더 많은 걸 얻었어요.",
  "전형 단계별로 무엇을 준비할지 표로 정리해주셨어요.",
  "예상 질문 리스트가 정말 유용했어요.",
  "조금 일반적인 조언이었지만 방향은 잡혔어요.",
];
const rotation = ["minjun", "jimin", "jiwoo", "seoyun"];

// ---------- normal completed bookings (chronological per specialist) ----------
let rot = 0;
for (const sp of specSpecs) {
  const n = sp.scores.length;
  sp.scores.forEach((score, i) => {
    const daysAgo = Math.round(58 - (i * 52) / Math.max(n - 1, 1));
    const startAt = pastSlot(sp.rules, Math.max(daysAgo, 3), i);
    completedBooking({
      seekerKey: rotation[rot++ % rotation.length], specKey: sp.key, category: sp.categories[i % sp.categories.length], startAt, score,
      reviewBody: reviewBodies[(i + rot) % reviewBodies.length], reviewDelayMin: 20 + ((i * 37) % 100),
    });
  });
}

// ---------- fraud cases ----------
// 1) reciprocal reviews + booking ring between 이도윤 and 한예린 (both are specialists and seekers)
completedBooking({ seekerKey: "yerin", specKey: "doyun", category: "resume", startAt: pastSlot(specSpecs[2].rules, 5), score: 97, reviewBody: "최고의 선배님이에요!", reviewDelayMin: 30, countStats: false, script: [0, 3, 12] });
completedBooking({ seekerKey: "doyun", specKey: "yerin", category: "interview", startAt: pastSlot(specSpecs[5].rules, 2), score: 98, reviewBody: "정말 완벽한 상담이었어요!", reviewDelayMin: 25, countStats: false, script: [0, 3, 12] });
// 2) burst: four 95+ reviews for 오태양 within 6 hours
{
  const base = pastSlot(specSpecs[6].rules, 28, 0);
  ["minjun", "jimin", "jiwoo", "seoyun"].forEach((sk, i) => {
    completedBooking({ seekerKey: sk, specKey: "taeyang", category: "career_change", startAt: new Date(base.getTime() + i * HOUR), score: 96 + i, reviewBody: "인생 상담이었어요. 무조건 추천!", reviewDelayMin: 20 + i * 5, countStats: false, script: [0, 3] });
  });
}
// 3) new account: 신규유저 reviews 최수아 with 100 one day after creation
completedBooking({ seekerKey: "newbie", specKey: "sua", category: "aptitude", startAt: new Date(now.getTime() - 20 * HOUR), score: 100, reviewBody: "완벽해요!!", reviewDelayMin: 30, countStats: false, script: [0, 3, 12] });

// ---------- live + upcoming bookings for 김지우 ----------
{
  const spec = specSpecs[0];
  const pb = currentPrice("seojun", spec.base);
  const startAt = new Date(now.getTime() - 10 * MIN);
  const id = uuid();
  db.insert(s.bookings).values({ id, seekerId: seekers.jiwoo, specialistId: specialists.seojun, category: "interview", startAt, endAt: new Date(startAt.getTime() + HOUR), price: pb.price, priceNote: priceNote(pb, "ko"), status: "confirmed", seekerNote: "삼성전자 하반기 공채 1차 면접 준비 중이에요.", createdAt: new Date(now.getTime() - DAY) }).run();
  postTx(db, { userId: seekers.jiwoo, type: "booking_hold", amount: -pb.price, bookingId: id, note: "박서준 상담 예약", createdAt: new Date(now.getTime() - DAY) });
  db.insert(s.notifications).values({ userId: seekers.jiwoo, kind: "session_soon", params: { name: spec.name }, href: `/sessions/${id}`, createdAt: new Date(now.getTime() - 15 * MIN) }).run();
  db.insert(s.notifications).values({ userId: specialists.seojun, kind: "session_soon", params: { name: "김지우" }, href: `/sessions/${id}`, createdAt: new Date(now.getTime() - 15 * MIN) }).run();
}
{
  const spec = specSpecs[1];
  const pb = currentPrice("haeun", spec.base);
  const startAt = futureSlot(spec.rules, 1, 0);
  const id = uuid();
  db.insert(s.bookings).values({ id, seekerId: seekers.jiwoo, specialistId: specialists.haeun, category: "portfolio", startAt, endAt: new Date(startAt.getTime() + HOUR), price: pb.price, priceNote: priceNote(pb, "ko"), status: "confirmed", seekerNote: "네이버 지원용 포트폴리오 봐주세요.", createdAt: new Date(now.getTime() - 2 * HOUR) }).run();
  postTx(db, { userId: seekers.jiwoo, type: "booking_hold", amount: -pb.price, bookingId: id, note: "김하은 상담 예약", createdAt: new Date(now.getTime() - 2 * HOUR) });
  db.insert(s.notifications).values({ userId: seekers.jiwoo, kind: "booking_created", params: { name: spec.name }, href: `/me/bookings`, createdAt: new Date(now.getTime() - 2 * HOUR) }).run();
  db.insert(s.notifications).values({ userId: specialists.haeun, kind: "booking_created", params: { name: "김지우" }, href: `/specialist/dashboard`, createdAt: new Date(now.getTime() - 2 * HOUR) }).run();
}

// ---------- open dispute: 이서윤 vs 한예린 ----------
{
  const spec = specSpecs[5];
  const pb = currentPrice("yerin", spec.base);
  const startAt = new Date(now.getTime() - 2 * DAY);
  const endAt = new Date(startAt.getTime() + HOUR);
  const id = uuid();
  db.insert(s.bookings).values({ id, seekerId: seekers.seoyun, specialistId: specialists.yerin, category: "resume", startAt, endAt, price: pb.price, priceNote: priceNote(pb, "ko"), status: "disputed", completedAt: endAt, createdAt: new Date(startAt.getTime() - 3 * DAY) }).run();
  postTx(db, { userId: seekers.seoyun, type: "booking_hold", amount: -pb.price, bookingId: id, note: "한예린 상담 예약", createdAt: new Date(startAt.getTime() - 3 * DAY) });
  addMessages(id, seekers.seoyun, specialists.yerin, new Date(startAt.getTime() + 20 * MIN), [42, 43]);
  db.insert(s.disputes).values({ bookingId: id, openedById: seekers.seoyun, reason: "20분 지각하셨고, 보내드린 자소서를 읽지 않고 오셨어요. 실제 상담 시간은 30분도 안 됐어요.", createdAt: new Date(endAt.getTime() + 2 * HOUR) }).run();
  db.insert(s.notifications).values({ userId: seekers.seoyun, kind: "dispute_update", params: { status: "open" }, href: "/me/bookings", createdAt: new Date(endAt.getTime() + 2 * HOUR), readAt: new Date(endAt.getTime() + 3 * HOUR) }).run();
}

// ---------- withdrawal request ----------
{
  const createdAt = new Date(now.getTime() - 3 * HOUR);
  db.insert(s.withdrawalRequests).values({ userId: specialists.seojun, amount: 1000, bankInfo: "카카오뱅크 3333-01-****", status: "pending", createdAt }).run();
  postTx(db, { userId: specialists.seojun, type: "withdrawal", amount: -1000, note: "출금 신청 (카카오뱅크)", createdAt });
}

// ---------- posts and clicks ----------
const postSpecs = [
  { author: "seojun", title: "삼성 면접 단골 질문 10가지", body: "면접관으로 3년간 들었던 질문 중 가장 자주 나온 열 가지를 정리했어요.\n\n1. 지원 직무에서 본인이 기여할 수 있는 점은?\n2. 실패 경험과 배운 점은?\n3. 팀에서 갈등을 해결한 경험은?\n…\n\n각 질문은 '경험 → 행동 → 결과' 순서로 90초 안에 답하는 연습을 하세요.", clicks: 40, days: 10 },
  { author: "haeun", title: "네이버 코테 3개월 로드맵", body: "1개월차: 구현·문자열·정렬을 매일 2문제.\n2개월차: BFS/DFS·백트래킹·DP 기본.\n3개월차: 기출 유형으로 모의 테스트를 주 2회.\n\n풀이 시간보다 '왜 틀렸는지' 기록이 더 중요해요.", clicks: 25, days: 7 },
  { author: "doyun", title: "자소서 첫 문장, 이렇게 쓰세요", body: "첫 문장은 결론부터. '저는 ~한 사람입니다'가 아니라 '저는 ~을 해서 ~을 만들었습니다'로 시작하세요.\n\n지원 동기는 회사가 아니라 직무에서 출발해야 읽는 사람이 납득해요.", clicks: 12, days: 5 },
];
const viewerPool = [...Object.values(seekers), ...Object.values(specialists)];
for (const ps of postSpecs) {
  const authorId = specialists[ps.author];
  const postId = uuid();
  db.insert(s.posts).values({ id: postId, authorId, title: ps.title, body: ps.body, clickCount: ps.clicks, createdAt: new Date(now.getTime() - ps.days * DAY) }).run();
  let made = 0;
  outer: for (let d = ps.days - 1; d >= 0; d--) {
    for (const viewerId of viewerPool) {
      if (viewerId === authorId) continue;
      if (made >= ps.clicks) break outer;
      const at = new Date(now.getTime() - d * DAY - ((made * 53) % 600) * MIN);
      db.insert(s.postClicks).values({ postId, viewerId, dayKey: seoulDayKey(at), createdAt: at }).run();
      postTx(db, { userId: authorId, type: "post_click", amount: 1, postId, note: "글 클릭 적립", createdAt: at });
      made++;
    }
  }
}

// ---------- stats + fraud scan ----------
for (const id of Object.values(specialists)) recomputeStats(db, id);
const scan = runFraudScan(db);

// ---------- report ----------
const count = (t: string) => (db.$client.prepare(`select count(*) as n from ${t}`).get() as { n: number }).n;
console.log("seeded", {
  users: count("users"), specialists: count("specialist_profiles"), bookings: count("bookings"), messages: count("messages"),
  reviews: count("reviews"), flags: count("review_flags"), posts: count("posts"), clicks: count("post_clicks"), ledger: count("credit_transactions"),
  scan,
});
const board = db.$client.prepare(`select u.name, sp.review_count as n, sp.avg_score as avg, sp.rank_score as rank, sp.base_price as base from specialist_profiles sp join users u on u.id = sp.user_id order by rank desc`).all() as { name: string; n: number; avg: number; rank: number; base: number }[];
for (const b of board) console.log(`  ${b.name.padEnd(4)} reviews=${b.n} avg=${b.avg} rank=${b.rank} price=${priceFor(b.base, b.n, b.avg).price}`);
const balances = db.$client.prepare(`select name, credit_balance as bal from users order by name`).all() as { name: string; bal: number }[];
console.log("  balances:", balances.map((b) => `${b.name}=${b.bal}`).join(" "));
const negative = balances.filter((b) => b.bal < 0);
if (negative.length) throw new Error("negative balances after seed: " + negative.map((b) => b.name).join(", "));
const flagged = db.$client.prepare(`select f.rule, u.name as reviewer, s2.name as specialist from review_flags f join reviews r on r.id=f.review_id join users u on u.id=r.reviewer_id join users s2 on s2.id=r.specialist_id order by f.rule`).all() as { rule: string; reviewer: string; specialist: string }[];
for (const f of flagged) console.log(`  flag ${f.rule}: ${f.reviewer} → ${f.specialist}`);
