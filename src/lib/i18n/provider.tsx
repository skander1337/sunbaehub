"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type Locale, type TFn } from "./dictionary";

const Ctx = createContext<{ locale: Locale; t: TFn } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}
