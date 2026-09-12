export type Locale = "ko" | "en";

export const ko = {
  "nav.specialists": "선배 찾기",
  "nav.leaderboard": "리더보드",
  "nav.posts": "글",
  "nav.bookings": "내 예약",
  "nav.credits": "크레딧",
  "nav.dashboard": "선배 대시보드",
  "nav.admin": "관리자",
  "nav.login": "로그인",
  "nav.logout": "로그아웃",
  "nav.switchUser": "사용자 전환",
  "nav.notifications": "알림",
  "common.credits": "크레딧",
  "common.creditsN": "{n} 크레딧",
  "common.won": "≈ ₩{n}",
  "common.demoData": "데모 데이터",
  "common.save": "저장",
  "common.cancel": "취소",
  "common.confirm": "확인",
  "common.back": "뒤로",
  "common.loading": "불러오는 중…",
  "common.empty": "아직 없어요.",
  "common.verified": "인증 선배",
  "common.pending": "인증 대기",
  "common.showOriginal": "원문 보기",
  "common.showTranslation": "번역 보기",
  "common.untranslated": "번역 없음",
  "common.autoTranslated": "자동 번역",
  "login.title": "누구로 들어갈까요?",
  "login.subtitle": "데모용 계정이에요. 카드를 누르면 바로 로그인돼요.",
  "login.seekers": "후배 (도움을 구하는 분)",
  "login.specialists": "선배 (전문가)",
  "login.admins": "관리자",
  "locale.ko": "한국어",
  "locale.en": "English",
} as const;

export type DictKey = keyof typeof ko;

export const en: Record<DictKey, string> = {
  "nav.specialists": "Find a sunbae",
  "nav.leaderboard": "Leaderboard",
  "nav.posts": "Posts",
  "nav.bookings": "My bookings",
  "nav.credits": "Credits",
  "nav.dashboard": "Sunbae dashboard",
  "nav.admin": "Admin",
  "nav.login": "Log in",
  "nav.logout": "Log out",
  "nav.switchUser": "Switch user",
  "nav.notifications": "Notifications",
  "common.credits": "credits",
  "common.creditsN": "{n} credits",
  "common.won": "≈ ₩{n}",
  "common.demoData": "Demo data",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.empty": "Nothing here yet.",
  "common.verified": "Verified sunbae",
  "common.pending": "Verification pending",
  "common.showOriginal": "Show original",
  "common.showTranslation": "Show translation",
  "common.untranslated": "Untranslated",
  "common.autoTranslated": "Auto-translated",
  "login.title": "Who are you signing in as?",
  "login.subtitle": "Demo accounts. Click a card to log in instantly.",
  "login.seekers": "Seekers",
  "login.specialists": "Sunbae (specialists)",
  "login.admins": "Admins",
  "locale.ko": "한국어",
  "locale.en": "English",
};

export const dictionaries: Record<Locale, Record<DictKey, string>> = { ko, en };

export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function makeT(locale: Locale) {
  const dict = dictionaries[locale];
  return (key: DictKey, params?: Record<string, string | number>) => format(dict[key] ?? key, params);
}
export type TFn = ReturnType<typeof makeT>;
