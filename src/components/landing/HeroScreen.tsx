"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCheck, IconArrow } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

export type HeroScreenProps = {
  href: string;
  name: string;
  initial: string;
  headline: string;
  verified: boolean;
  basePrice: number;
  price: number;
  multiplier: number;
  reviewCount: number;
  avgScore: number;
  won: number;
  price30: number;
  slots: { label: string; sub: string }[];
};

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export function HeroScreen(p: HeroScreenProps) {
  const { t, locale } = useI18n();
  const [k, setK] = useState(0); // 0 → 1 progress of the count-up
  const [risen, setRisen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setK(1);
      setRisen(true);
      return;
    }
    const raf1 = requestAnimationFrame(() => setRisen(true));
    let raf = 0;
    const t0 = performance.now() + 350;
    const dur = 1400;
    const tick = (now: number) => {
      const x = Math.min(1, Math.max(0, (now - t0) / dur));
      setK(easeOut(x));
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Hard fallback: whatever happens to rAF (background tab, throttling, virtual time), land on the final numbers.
    const settle = window.setTimeout(() => setK(1), 2400);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
  }, []);

  const price = Math.round(p.basePrice + (p.price - p.basePrice) * k);
  const reviews = Math.round(p.reviewCount * k);
  const avg = Math.round(p.avgScore * k);
  const mult = 1 + (p.multiplier - 1) * k;
  const note =
    locale === "ko" ? `기본가의 ${mult.toFixed(2)}배 · 리뷰 ${reviews}개 · 평균 ${avg}점` : `${mult.toFixed(2)}× base · ${reviews} reviews · avg ${avg}`;

  return (
    <div
      className={`card mx-auto w-full max-w-[760px] p-5 shadow-raise transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:p-7 ${
        risen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      }`}
      aria-label={`${p.name} booking card`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[17px] font-bold text-brand">{p.initial}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold">{p.name}</span>
              {p.verified && (
                <span className="tag tag-brand gap-0.5">
                  <IconCheck size={12} strokeWidth={2.5} />
                  {t("card.verified")}
                </span>
              )}
            </div>
            <p className="muted mt-0.5 text-[14px]">{p.headline}</p>
            <p className="tnum mt-1.5 text-[13px] text-ink-2">
              <span className="font-semibold text-ink">{avg}</span>
              <span className="text-ink-3">/100 · </span>
              {t("landing.reviewsN", { n: reviews })}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="tnum text-[32px] leading-none font-extrabold tracking-[-0.03em]">{t("common.creditsN", { n: price })}</div>
          <div className="tnum mt-1.5 text-[13px] text-ink-2">{note}</div>
          <div className="tnum mt-0.5 text-[12px] text-ink-3">
            ≈ ₩{Math.round(price * p.won).toLocaleString()} · {t("landing.perHour", { n: t("common.creditsN", { n: p.price30 }) })}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[12px] font-semibold text-ink-3">{t("landing.screenNext")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.slots.map((s, i) => (
              <span key={s.label + i} className={`tnum inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13.5px] font-semibold ${i === 0 ? "bg-brand text-white" : "bg-mist text-ink"}`}>
                {s.label}
                <span className={i === 0 ? "text-white/70" : "text-ink-3"}>{s.sub}</span>
              </span>
            ))}
          </div>
        </div>
        <Link href={p.href} className="btn btn-primary">
          {t("landing.screenBook")}
          <IconArrow size={18} />
        </Link>
      </div>
    </div>
  );
}
