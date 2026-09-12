"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { useI18n } from "@/lib/i18n/provider";

export function LocaleToggle({ tone = "paper" }: { tone?: "paper" | "brand" }) {
  const { locale } = useI18n();
  const [pending, start] = useTransition();
  const next = locale === "ko" ? "en" : "ko";
  const onBrand = tone === "brand";
  return (
    <button
      type="button"
      onClick={() => start(() => setLocale(next))}
      disabled={pending}
      aria-label={locale === "ko" ? "Switch to English" : "한국어로 전환"}
      className={`inline-flex h-9 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-semibold transition-colors duration-200 ${
        onBrand ? "text-white/85 hover:bg-white/10" : "text-ink-2 hover:bg-mist"
      } disabled:opacity-60`}
    >
      <span className={locale === "ko" ? "" : "opacity-50"}>KO</span>
      <span className={onBrand ? "text-white/40" : "text-ink-3"}>/</span>
      <span className={locale === "en" ? "" : "opacity-50"}>EN</span>
    </button>
  );
}
