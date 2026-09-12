/** Asia/Seoul is a fixed UTC+9 (no DST since 1988), so arithmetic is safe without a date library. */
const OFFSET_MS = 9 * 60 * 60 * 1000;

export type SeoulParts = { y: number; m: number; d: number; dow: number; minutes: number };

/** Calendar parts of an instant, as seen on a Seoul wall clock. `m` is 0-based. */
export function seoulParts(date: Date): SeoulParts {
  const t = new Date(date.getTime() + OFFSET_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth(),
    d: t.getUTCDate(),
    dow: t.getUTCDay(),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

/** Instant for a Seoul wall-clock time. Day overflow is allowed (d = 32 rolls into next month). */
export function fromSeoul(y: number, m: number, d: number, minutes = 0): Date {
  return new Date(Date.UTC(y, m, d, 0, minutes) - OFFSET_MS);
}

export function seoulDayKey(date: Date): string {
  const p = seoulParts(date);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function addSeoulDays(date: Date, days: number): Date {
  const p = seoulParts(date);
  return fromSeoul(p.y, p.m, p.d + days, p.minutes);
}

export function startOfSeoulDay(date: Date): Date {
  const p = seoulParts(date);
  return fromSeoul(p.y, p.m, p.d, 0);
}

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayName(dow: number, locale: "ko" | "en"): string {
  return (locale === "ko" ? KO_DAYS : EN_DAYS)[dow] ?? "";
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function fmtDate(date: Date, locale: "ko" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function fmtTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function fmtDateTime(date: Date, locale: "ko" | "en"): string {
  return `${fmtDate(date, locale)} ${fmtTime(date)}`;
}

export function fmtRelativeDay(date: Date, now: Date, locale: "ko" | "en"): string {
  const diff = Math.round((startOfSeoulDay(date).getTime() - startOfSeoulDay(now).getTime()) / 86400000);
  if (locale === "ko") {
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    if (diff === -1) return "어제";
    return diff > 0 ? `D-${diff}` : `${-diff}일 전`;
  }
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `D-${diff}` : `${-diff}d ago`;
}
