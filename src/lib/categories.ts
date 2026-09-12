export type CategoryId =
  | "resume"
  | "interview"
  | "gongchae"
  | "portfolio"
  | "aptitude"
  | "career_change"
  | "coding_test";

export const CATEGORIES: { id: CategoryId; ko: string; en: string }[] = [
  { id: "resume", ko: "자기소개서 첨삭", en: "Cover letter review" },
  { id: "interview", ko: "면접 코칭", en: "Interview coaching" },
  { id: "gongchae", ko: "공채 준비", en: "Open-recruitment prep" },
  { id: "portfolio", ko: "포트폴리오 리뷰", en: "Portfolio review" },
  { id: "aptitude", ko: "인적성 준비", en: "Aptitude test prep" },
  { id: "career_change", ko: "이직 상담", en: "Career-change advice" },
  { id: "coding_test", ko: "코딩테스트 준비", en: "Coding test prep" },
];

export function categoryLabel(id: string, locale: "ko" | "en"): string {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c[locale] : id;
}
