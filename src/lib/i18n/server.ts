import "server-only";
import { cookies } from "next/headers";
import { makeT, type Locale } from "./dictionary";

export const LOCALE_COOKIE = "sunbae_locale";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return v === "en" ? "en" : "ko";
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
