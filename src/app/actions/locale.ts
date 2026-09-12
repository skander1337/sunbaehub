"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/dictionary";

export async function setLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale === "en" ? "en" : "ko", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
