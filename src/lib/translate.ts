export type Lang = "ko" | "en";

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

export function detectLang(text: string): Lang {
  return HANGUL.test(text) ? "ko" : "en";
}

/**
 * Demo translation stub. A real provider (Claude, DeepL, Papago) would implement the same
 * signature; the app never depends on anything but `translate(text, from, to)`.
 */
export type Translation = { text: string; matched: boolean };

const PHRASES: [ko: string, en: string][] = [
  ["안녕하세요!", "Hello!"],
  ["안녕하세요, 선배님.", "Hello, sunbae."],
  ["안녕하세요, 지우님.", "Hello, Jiwoo."],
  ["반가워요.", "Nice to meet you."],
  ["네", "Yes"],
  ["아니요", "No"],
  ["알겠습니다.", "Understood."],
  ["잠시만요.", "One moment."],
  ["감사합니다!", "Thank you!"],
  ["정말 도움이 됐어요.", "That was really helpful."],
  ["세션 시작할게요.", "Let's start the session."],
  ["오늘 세션은 여기까지 할게요.", "Let's wrap up today's session here."],
  ["수고하셨어요.", "Great work today."],
  ["좋은 결과 있길 바랄게요!", "Wishing you a great outcome!"],
  ["질문 있으면 편하게 물어보세요.", "Feel free to ask anything."],
  ["다음 주에 다시 뵐 수 있을까요?", "Can we meet again next week?"],
  ["네, 가능해요.", "Yes, that works."],
  ["오늘 자기소개서 첨삭 부탁드려요.", "I'd like help reviewing my cover letter today."],
  ["네, 자소서 파일을 먼저 보여주실 수 있을까요?", "Sure, could you share your cover letter first?"],
  ["자기소개서 요약본을 보내드릴게요.", "I'll send you a summary of my cover letter."],
  ["지원 동기 문단이 너무 길어요.", "The motivation paragraph is too long."],
  ["첫 문장은 결론부터 쓰는 게 좋아요.", "Start the first sentence with your conclusion."],
  ["이 부분은 우대사항과 연결하면 좋겠어요.", "Connect this part to the preferred qualifications."],
  ["숫자로 성과를 보여주세요.", "Show your results with numbers."],
  ["삼성 면접에서 자주 나오는 질문이 뭔가요?", "What questions come up often in Samsung interviews?"],
  ["직무 관련 경험을 구체적으로 물어봐요.", "They ask concretely about job-related experience."],
  ["면접 때 긴장을 어떻게 푸나요?", "How do you calm nerves during an interview?"],
  ["예상 질문 10개를 미리 소리 내어 연습하세요.", "Practice ten expected questions out loud in advance."],
  ["면접 복장은 어떻게 하는 게 좋을까요?", "What should I wear to the interview?"],
  ["단정한 비즈니스 캐주얼이면 충분해요.", "Neat business casual is enough."],
  ["포트폴리오에서 프로젝트 3개만 남기세요.", "Keep only three projects in your portfolio."],
  ["코딩테스트는 어떤 문제 유형이 많이 나와요?", "What problem types are common in coding tests?"],
  ["구현과 BFS/DFS 문제가 가장 많아요.", "Implementation and BFS/DFS problems are the most common."],
  ["하루에 두 문제씩 꾸준히 푸는 게 중요해요.", "Solving two problems a day consistently matters most."],
  ["인적성은 시간 관리가 핵심이에요.", "Time management is the key to aptitude tests."],
  ["이직 준비는 언제 시작하는 게 좋을까요?", "When should I start preparing for a job change?"],
  ["현재 회사에서 성과를 하나 더 만든 뒤가 좋아요.", "After you have one more achievement at your current company."],
  ["제 이력서를 봐주실 수 있나요?", "Could you look at my resume?"],
  ["네, 지금 확인할게요.", "Sure, I'll check it now."],
  ["경력 기술은 최근 순으로 정리하세요.", "List your experience in reverse chronological order."],
  ["공채 일정이 겹치면 어떻게 하죠?", "What if open-recruitment schedules overlap?"],
  ["우선순위를 정하고 하나에 집중하세요.", "Set priorities and focus on one."],
  ["20분 늦으셨는데 괜찮으세요?", "You were 20 minutes late, is everything okay?"],
  ["죄송해요, 회의가 길어졌어요.", "Sorry, my meeting ran long."],
];

const normalize = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?~。！？]+$/u, "")
    .toLowerCase();

const KO_TO_EN = new Map(PHRASES.map(([ko, en]) => [normalize(ko), en]));
const EN_TO_KO = new Map(PHRASES.map(([ko, en]) => [normalize(en), ko]));

export function translate(text: string, from: Lang, to: Lang): Translation {
  if (from === to) return { text, matched: true };
  const table = from === "ko" ? KO_TO_EN : EN_TO_KO;
  const hit = table.get(normalize(text));
  return hit ? { text: hit, matched: true } : { text, matched: false };
}

/** Phrases the seed can draw from so seeded conversations translate cleanly. */
export const DEMO_PHRASES = PHRASES;
