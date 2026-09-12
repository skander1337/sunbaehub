/**
 * Record real account creation and specialist approval through the application UI.
 * The supplied database is used only to identify and verify UI-created records.
 */
export async function recordOnboarding({
  page, scene, pause, type, click, show, login, logout, db, base, cvPath, users,
}) {
  const hold = async (ms = 700) => pause(ms);
  const main = page.locator("main");
  const field = (name) => page.locator(`[name="${name}"]`);
  const userId = (email) => {
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (!row) throw new Error(`Recording signup did not create ${email}`);
    return row.id;
  };

  await page.goto(`${base}/signup?role=seeker`);
  await main.getByRole("heading", { name: "회원가입", exact: true }).waitFor();
  await scene("후배로 회원가입", "후배 계정을 만들면 첫 상담을 위한 70크레딧을 받아요.", async () => {
    await type(field("name"), users.seeker.name);
    await type(field("email"), users.seeker.email);
    await type(field("password"), users.seeker.password);
    await type(field("affiliation"), "고려대학교 경영학과 4학년");
    await show(main.locator('form:has(input[name="affiliation"])'), 4000);
    await click(main.getByRole("button", { name: "가입하기", exact: true }));
    await page.waitForURL(/\/specialists(?:\?.*)?$/, { timeout: 20_000 });
    await main.locator("h1").waitFor();
    await show(main.locator("h1"), 5000);
  }, { minSeconds: 20 });

  const seekerId = userId(users.seeker.email);
  const seeker = db.prepare("SELECT credit_balance AS balance, affiliation FROM users WHERE id = ?").get(seekerId);
  if (seeker.balance !== 70 || !seeker.affiliation) throw new Error("Seeker welcome credits or affiliation missing");

  await scene("후배 계정으로 로그인", "로그아웃한 뒤 방금 만든 후배 계정으로 다시 로그인해요.", async () => {
    await logout();
    await login(users.seeker);
    await page.waitForURL(/\/specialists(?:\?.*)?$/, { timeout: 20_000 });
    await show(main.locator("h1"), 4000);
  }, { minSeconds: 16 });

  await logout();
  await page.goto(`${base}/signup?role=expert`);
  await main.getByRole("heading", { name: "회원가입", exact: true }).waitFor();
  await scene("선배로 회원가입", "상담을 제공할 선배 계정을 만들고 프로필 등록을 시작해요.", async () => {
    await type(field("name"), users.expert.name);
    await type(field("email"), users.expert.email);
    await type(field("password"), users.expert.password);
    await show(main.locator('form:has(input[name="password"])'), 4000);
    await click(main.getByRole("button", { name: "가입하기", exact: true }));
    await page.waitForURL(/\/specialist\/onboarding(?:\?.*)?$/, { timeout: 20_000 });
    await main.getByRole("heading", { name: "선배 프로필 설정", exact: true }).waitFor();
    await show(main.getByRole("heading", { name: "선배 프로필 설정", exact: true }), 5000);
  }, { minSeconds: 20 });

  const expertId = userId(users.expert.email);
  await scene("선배 프로필 작성", "전문 분야와 상담 주제를 고르고 희망 상담료를 입력해요.", async () => {
    await type(field("headline"), "프로덕트 디자이너 · 포트폴리오와 면접 코칭");
    await type(field("bio"), "주니어 디자이너의 프로젝트를 설득력 있는 포트폴리오로 정리하고, 자신 있게 면접에서 설명할 수 있도록 도와드려요.");
    await click(page.locator('label:has(input[name="categories"][value="portfolio"])'));
    await click(page.locator('label:has(input[name="categories"][value="interview"])'));
    await type(field("requestedRate"), "240");
    await show(main.locator('section:has(input[name="headline"])'), 5500);
  }, { minSeconds: 25 });

  await scene("학력과 경력 인증 요청", "학력과 경력을 입력하고 이력서를 첨부해 운영팀 심사를 요청해요.", async () => {
    await type(field("edu_school_0"), "홍익대학교");
    await type(field("edu_major_0"), "시각디자인");
    await type(field("edu_degree_0"), "학사");
    await type(field("edu_years_0"), "2015년–2019년");
    await show(main.locator('section:has(input[name="edu_school_0"])'), 5000);
    await type(field("exp_company_0"), "서울 디자인 스튜디오");
    await type(field("exp_title_0"), "시니어 프로덕트 디자이너");
    await type(field("exp_years_0"), "2019년–현재");
    await show(main.locator('section:has(input[name="exp_company_0"])'), 5000);
    await show(main.locator('section:has(input[name="resume"])'), 2000);
    await field("resume").setInputFiles(cvPath);
    await show(main.locator('section:has(input[name="resume"])'), 5000);
    await click(main.getByRole("button", { name: "심사 요청하기", exact: true }));
    await page.waitForURL(/\/specialist\/dashboard\?submitted=1$/, { timeout: 20_000 });
    await main.getByRole("heading", { name: "운영팀이 프로필을 검토하고 있어요", exact: true }).waitFor();
    await show(main.getByRole("heading", { name: "운영팀이 프로필을 검토하고 있어요", exact: true }), 5000);
  }, { minSeconds: 35 });

  const pending = db.prepare("SELECT verification, resume_path FROM specialist_profiles WHERE user_id = ?").get(expertId);
  if (pending?.verification !== "pending" || !pending.resume_path) throw new Error("Specialist profile was not submitted with a CV");

  await scene("선배 계정으로 로그인", "선배 계정으로 다시 로그인하면 인증 심사 상태를 확인할 수 있어요.", async () => {
    await logout();
    await login(users.expert);
    await page.waitForURL(/\/specialist\/dashboard(?:\?.*)?$/, { timeout: 20_000 });
    await main.getByText("검토 중", { exact: true }).waitFor();
    await show(main.getByRole("heading", { name: "운영팀이 프로필을 검토하고 있어요", exact: true }), 4500);
  }, { minSeconds: 16 });

  await logout();
  await login(users.admin);
  await page.goto(`${base}/admin/verifications`);
  const approvalForm = page.locator(`form:has(input[name="userId"][value="${expertId}"])`);
  const approvalCard = page.locator("li").filter({ has: approvalForm });
  await approvalForm.waitFor();
  await scene("관리자가 선배 인증 승인", "운영팀이 학력과 경력을 검토하고 기본가 240크레딧으로 승인해요.", async () => {
    await approvalCard.getByText(users.expert.name, { exact: true }).waitFor();
    await show(approvalCard, 6000);
    await type(approvalForm.locator('input[name="baseRate"]'), "240");
    await show(approvalForm, 4000);
    await click(approvalForm.locator('button[name="decision"][value="verified"]'));
    await approvalForm.waitFor({ state: "detached", timeout: 20_000 });
    await show(main.getByRole("heading", { name: "관리자", exact: true }), 4000);
  }, { minSeconds: 20 });

  const approved = db.prepare("SELECT verification, base_price FROM specialist_profiles WHERE user_id = ?").get(expertId);
  if (approved?.verification !== "verified" || approved.base_price !== 240) throw new Error("Admin approval did not apply the requested base rate");

  await logout();
  await login(users.expert);
  await scene("인증 완료, 상담 준비 끝", "승인된 선배는 프로필이 공개되고 상담 예약과 글쓰기가 가능해져요.", async () => {
    await page.waitForURL(/\/specialist\/dashboard(?:\?.*)?$/, { timeout: 20_000 });
    await main.getByText("인증됨", { exact: true }).waitFor();
    await main.getByRole("link", { name: "글 쓰기", exact: true }).waitFor();
    await show(main.locator("dl").first(), 5500);
    await show(main.getByRole("navigation", { name: "관리", exact: true }), 4500);
  }, { minSeconds: 12 });

  await scene("상담 가능한 시간 설정", "요일별 상담 시간을 열어두면 이미 예약된 시간은 자동으로 제외돼요.", async () => {
    await click(main.getByRole("link", { name: "가능 시간", exact: true }));
    await page.waitForURL(/\/specialist\/availability(?:\?.*)?$/, { timeout: 20_000 });
    await show(main.locator('form:has(select[name="d1_w0_start"])'), 4500);
    for (const day of [1, 2, 3, 4, 5, 6, 0]) {
      const start = page.locator(`select[name="d${day}_w0_start"]`);
      const end = page.locator(`select[name="d${day}_w0_end"]`);
      const row = main.locator(`tr:has(select[name="d${day}_w0_start"])`);
      await show(row, 0);
      await start.selectOption("9");
      if (day === 1) await hold(800);
      await end.selectOption("22");
      // Demonstrate Monday clearly, then work through the remaining days at a steady pace.
      if (day === 1) await show(row, 4000);
      else await hold(500);
    }
    await show(main.locator('form:has(select[name="d1_w0_start"])'), 5000);
    await click(main.locator('form button[type="submit"]'));
    await page.waitForURL(/\/specialist\/availability\?saved=1$/, { timeout: 20_000 });
    await main.getByText("가능 시간을 저장했어요.", { exact: true }).waitFor();
    await show(main.getByText("가능 시간을 저장했어요.", { exact: true }), 5000);
  }, { minSeconds: 26 });

  const rules = db.prepare("SELECT count(*) AS n FROM availability_rules WHERE specialist_id = ? AND start_minute = 540 AND end_minute = 1320").get(expertId);
  if (rules.n !== 7) throw new Error("Weekly availability was not saved for all seven days");

  return { seekerId, expertId };
}
