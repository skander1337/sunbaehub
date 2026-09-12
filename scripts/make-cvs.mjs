// Generates realistic (synthetic) one-page CVs for the seeded specialists as PDFs via Chrome.
// Usage: node scripts/make-cvs.mjs  → seed-assets/cv/<key>.pdf (committed; the seed copies them into uploads/).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const CVS = [
  { key: "seojun", name: "박서준", title: "인사팀 채용 담당 · 삼성전자", email: "seojun.park@example.com", phone: "010-2481-3390", location: "서울 서초구",
    summary: "삼성전자 인사팀에서 신입 공채 채용을 5년째 담당하고 있습니다. 서류 평가 기준 수립과 면접관 교육을 맡았고, 3년간 직접 면접관으로 참여했습니다.",
    education: [{ school: "고려대학교", major: "경영학과 학사", years: "2014 – 2020", note: "인사조직 전공, 학점 3.8/4.5" }],
    experience: [
      { company: "삼성전자", title: "인사팀 채용 담당 (대리)", years: "2020 – 현재", bullets: ["신입 공채 서류·면접 전형 운영 (연 2회, 지원자 1만 명 규모)", "면접관 교육 프로그램 설계 및 운영, 면접 평가표 개편", "직무적합성 기준 수립으로 1차 합격자의 최종 합격률 12%p 개선"] },
      { company: "삼성전자", title: "인사팀 인턴", years: "2019.06 – 2019.08", bullets: ["채용 브랜딩 콘텐츠 제작, 대학 채용설명회 운영 지원"] },
    ],
    skills: ["구조화 면접 설계", "역량 기반 평가", "채용 데이터 분석 (Excel, SQL)", "HR 애널리틱스"],
    extras: ["공인노무사 1차 합격 (2021)", "TOEIC 935", "영어 면접 가능"] },
  { key: "haeun", name: "김하은", title: "백엔드 개발자 · 네이버", email: "haeun.kim@example.com", phone: "010-7742-1108", location: "경기 성남시",
    summary: "네이버 검색 플랫폼 백엔드를 4년째 개발하고 있습니다. 대규모 트래픽 서비스 운영 경험이 있고, 사내 코딩테스트 출제와 채점에 참여했습니다.",
    education: [{ school: "고려대학교", major: "컴퓨터학과 학사", years: "2015 – 2021", note: "졸업 프로젝트 우수상, 알고리즘 동아리 회장" }],
    experience: [
      { company: "네이버", title: "백엔드 개발자", years: "2021 – 현재", bullets: ["검색 인덱싱 파이프라인 개발 및 운영 (Java, Kotlin, Kafka)", "신입 채용 코딩테스트 문제 출제·검수 3회", "장애 대응 프로세스 개선으로 MTTR 40% 단축"] },
      { company: "스타트업 A", title: "개발 인턴", years: "2020.07 – 2020.12", bullets: ["Spring Boot 기반 주문 API 개발, 테스트 커버리지 80% 달성"] },
    ],
    skills: ["Java / Kotlin", "Spring", "Kafka, Redis", "MySQL", "Kubernetes", "알고리즘 · 자료구조"],
    extras: ["정보처리기사", "ACM-ICPC 서울 지역 예선 본선 진출 (2019)"] },
  { key: "doyun", name: "이도윤", title: "프로덕트 매니저 · 카카오", email: "doyun.lee@example.com", phone: "010-3315-6672", location: "경기 성남시",
    summary: "제조 대기업, 스타트업, 카카오까지 세 번의 이직을 거치며 서비스 기획자로 성장했습니다. 지원 서류를 수십 번 고쳐 쓴 경험을 나눕니다.",
    education: [{ school: "고려대학교", major: "산업경영공학부 학사", years: "2012 – 2018", note: "" }],
    experience: [
      { company: "카카오", title: "프로덕트 매니저", years: "2022 – 현재", bullets: ["메시징 서비스 신규 기능 기획, MAU 3% 증가에 기여", "데이터 기반 우선순위 프레임워크 도입"] },
      { company: "스타트업 B", title: "서비스 기획", years: "2020 – 2022", bullets: ["0→1 서비스 런칭, 초기 사용자 인터뷰 60회 진행"] },
      { company: "LG CNS", title: "서비스 기획", years: "2018 – 2020", bullets: ["B2B 물류 시스템 요구사항 정의 및 화면 설계"] },
    ],
    skills: ["서비스 기획", "사용자 리서치", "SQL", "Figma", "A/B 테스트"],
    extras: ["ADsP (데이터분석 준전문가)", "PM 커뮤니티 운영진"] },
  { key: "sua", name: "최수아", title: "채용팀 · 현대자동차", email: "sua.choi@example.com", phone: "010-9056-2217", location: "서울 서초구",
    summary: "현대자동차 채용팀에서 공채 전형 운영과 인적성 검사를 담당합니다. 전형 단계별로 무엇이 평가되는지 실제 기준으로 설명할 수 있습니다.",
    education: [{ school: "고려대학교", major: "심리학과 학사", years: "2013 – 2019", note: "산업·조직심리 전공" }],
    experience: [
      { company: "현대자동차", title: "채용팀 (대리)", years: "2019 – 현재", bullets: ["신입·경력 공채 전형 운영, 인적성 검사(HMAT) 시행 총괄 보조", "면접 평가 기준 정비 및 면접관 가이드 제작", "채용 설명회 30회 이상 진행"] },
    ],
    skills: ["채용 전형 운영", "인적성 검사", "면접 평가 설계", "HR 데이터 관리"],
    extras: ["심리측정 워크숍 수료", "TOEIC Speaking 170"] },
  { key: "minjae", name: "정민재", title: "데이터 분석가 · 토스", email: "minjae.jung@example.com", phone: "010-4420-8831", location: "서울 강남구",
    summary: "토스에서 프로덕트 데이터 분석을 맡고 있습니다. 통계학 석사 과정에서 실험 설계를 연구했고, 분석 포트폴리오로 데이터 직군 취업에 성공한 경험을 공유합니다.",
    education: [{ school: "고려대학교", major: "통계학과 석사", years: "2020 – 2022", note: "실험설계 · 인과추론" }, { school: "고려대학교", major: "통계학과 학사", years: "2016 – 2020", note: "" }],
    experience: [
      { company: "토스", title: "데이터 분석가", years: "2022 – 현재", bullets: ["A/B 테스트 플랫폼 지표 설계, 실험 200건 이상 분석", "리텐션 분석 대시보드 구축 (SQL, Python)"] },
    ],
    skills: ["Python (pandas, statsmodels)", "SQL", "실험 설계 · 인과추론", "Tableau", "dbt"],
    extras: ["데이터분석 전문가 (ADP) 필기 합격", "Kaggle Expert"] },
  { key: "yerin", name: "한예린", title: "브랜드 마케팅 · 쿠팡", email: "yerin.han@example.com", phone: "010-6183-4409", location: "서울 송파구",
    summary: "LG전자에서 시작해 쿠팡 브랜드 마케팅까지 6년차 마케터입니다. 마케팅 직군 자소서와 면접 답변을 함께 다듬어 드립니다.",
    education: [{ school: "고려대학교", major: "미디어학부 학사", years: "2011 – 2017", note: "" }],
    experience: [
      { company: "쿠팡", title: "브랜드 마케팅 매니저", years: "2021 – 현재", bullets: ["카테고리 캠페인 기획·집행, 연간 예산 20억 규모 운영", "퍼포먼스 지표 기반 크리에이티브 최적화로 CTR 1.8배"] },
      { company: "LG전자", title: "마케팅", years: "2017 – 2021", bullets: ["가전 신제품 런칭 캠페인 4회, 리테일 프로모션 운영"] },
    ],
    skills: ["브랜드 캠페인", "퍼포먼스 마케팅", "GA4", "콘텐츠 기획", "미디어 믹스"],
    extras: ["구글 애즈 인증", "TOEIC 900"] },
  { key: "taeyang", name: "오태양", title: "CTO · 시리즈 B 스타트업", email: "taeyang.oh@example.com", phone: "010-5528-7714", location: "서울 강남구",
    summary: "시리즈 B 스타트업의 CTO로 개발 조직을 이끌고 있습니다. 개발자 채용을 50회 넘게 진행하며 이력서와 포트폴리오에서 무엇이 신뢰를 주는지 봐왔습니다.",
    education: [{ school: "고려대학교", major: "전기전자공학부 학사", years: "2009 – 2015", note: "" }],
    experience: [
      { company: "스타트업 C (시리즈 B)", title: "CTO", years: "2020 – 현재", bullets: ["개발 조직 4명 → 28명 성장, 채용 프로세스 설계", "핵심 서비스 아키텍처 전환 (모놀리스 → 마이크로서비스)"] },
      { company: "스타트업 D", title: "백엔드 리드", years: "2017 – 2020", bullets: ["결제 시스템 개발, PCI-DSS 대응"] },
      { company: "SK텔레콤", title: "소프트웨어 엔지니어", years: "2015 – 2017", bullets: ["네트워크 관리 시스템 개발"] },
    ],
    skills: ["시스템 설계", "Go, TypeScript", "AWS", "엔지니어링 매니지먼트", "기술 면접 설계"],
    extras: ["AWS Solutions Architect Professional"] },
  { key: "seoyeon", name: "윤서연", title: "컨설턴트 · 삼성SDS", email: "seoyeon.yoon@example.com", phone: "010-8890-2345", location: "서울 송파구",
    summary: "삼성SDS에서 IT 컨설팅 3년차입니다. 공채 전형과 인적성 검사를 최근에 통과한 경험을 바탕으로 준비 방법을 나눕니다.",
    education: [{ school: "고려대학교", major: "경제학과 학사", years: "2016 – 2022", note: "" }],
    experience: [
      { company: "삼성SDS", title: "컨설턴트", years: "2023 – 현재", bullets: ["제조 고객사 ERP 전환 프로젝트 PMO 지원", "요구사항 분석 및 프로세스 설계 문서화"] },
    ],
    skills: ["프로세스 분석", "PowerPoint · Excel", "SAP 기본", "커뮤니케이션"],
    extras: ["삼성 GSAT 합격 (2022 하반기)", "TOEIC 920"] },
];

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const html = (c) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif; color: #191f28; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  h1 { font-size: 22pt; margin: 0; letter-spacing: -0.02em; }
  .title { color: #4e5968; font-size: 11pt; margin-top: 2px; }
  .contact { color: #6b7684; font-size: 9pt; margin-top: 6px; }
  h2 { font-size: 10pt; letter-spacing: 0.08em; color: #2b44a8; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e8eb; text-transform: uppercase; }
  .row { display: flex; justify-content: space-between; gap: 12px; }
  .row b { font-size: 10.5pt; }
  .years { color: #6b7684; font-size: 9.5pt; white-space: nowrap; }
  .sub { color: #4e5968; }
  ul { margin: 3px 0 8px; padding-left: 16px; } li { margin: 1px 0; }
  .chips span { display: inline-block; background: #f2f4f6; border-radius: 6px; padding: 2px 8px; margin: 2px 4px 2px 0; font-size: 9.5pt; }
  .foot { margin-top: 22px; color: #8b95a1; font-size: 8.5pt; }
</style></head><body>
  <h1>${esc(c.name)}</h1>
  <div class="title">${esc(c.title)}</div>
  <div class="contact">${esc(c.email)} · ${esc(c.phone)} · ${esc(c.location)}</div>
  <h2>Summary</h2><p>${esc(c.summary)}</p>
  <h2>Experience</h2>
  ${c.experience.map((e) => `<div class="row"><div><b>${esc(e.company)}</b> <span class="sub">· ${esc(e.title)}</span></div><div class="years">${esc(e.years)}</div></div><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`).join("")}
  <h2>Education</h2>
  ${c.education.map((e) => `<div class="row"><div><b>${esc(e.school)}</b> <span class="sub">· ${esc(e.major)}</span>${e.note ? `<div class="sub" style="font-size:9.5pt">${esc(e.note)}</div>` : ""}</div><div class="years">${esc(e.years)}</div></div>`).join("")}
  <h2>Skills</h2><div class="chips">${c.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
  <h2>Certifications & Others</h2><ul>${c.extras.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
  <div class="foot">이 이력서는 선배 Sunbae 데모용으로 생성된 가상의 문서입니다. 실존 인물과 관련이 없습니다.</div>
</body></html>`;

mkdirSync("seed-assets/cv", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
for (const c of CVS) {
  await page.setContent(html(c), { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  writeFileSync(`seed-assets/cv/${c.key}.pdf`, pdf);
  console.log(`wrote seed-assets/cv/${c.key}.pdf (${(pdf.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
