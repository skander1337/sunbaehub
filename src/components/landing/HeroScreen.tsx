"use client";

import Link from "next/link";
import { IconCheck, IconArrow } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

export type HeroScreenProps = {
  href: string;
  name: string;
  initial: string;
  headline: string;
  verified: boolean;
  price: number;
  multiplier: number;
  reviewCount: number;
  avgScore: number;
  won: number;
  price30: number;
  slots: { label: string; sub: string }[];
  /** A real visible review of this sunbae, shown as one quiet line under the rating. */
  review?: { score: number; body: string } | null;
};

export function HeroScreen(p: HeroScreenProps) {
  const { t, locale } = useI18n();
  const { price, reviewCount: reviews, multiplier: mult } = p;
  const avg = Math.round(p.avgScore);
  const note =
    locale === "ko" ? `기본가의 ${mult.toFixed(2)}배 · 리뷰 ${reviews}개 · 평균 ${avg}점` : `${mult.toFixed(2)}× base · ${reviews} reviews · avg ${avg}`;

  return (
    <div
      className="hero-screen card mx-auto w-full max-w-[760px] p-5 shadow-raise sm:p-7"
      aria-label={t("landing.heroCardLabel", { name: p.name })}
      data-testid="landing-booking-card"
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
              <span className="text-ink-2">/100 · </span>
              {t("landing.reviewsN", { n: reviews })}
            </p>
            {p.review && (
              <p className="mt-2 flex max-w-[44ch] items-baseline gap-2 text-[13px]">
                <span className="tag tag-neutral tnum shrink-0">{t("landing.reviewTag", { n: p.review.score })}</span>
                <span className="line-clamp-1 text-ink-2">{p.review.body}</span>
              </p>
            )}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="tnum text-[32px] leading-none font-extrabold tracking-[-0.03em]">{t("common.creditsN", { n: price })}</div>
          <div className="tnum mt-1.5 text-[13px] text-ink-2">{note}</div>
          <div className="tnum mt-1 text-[13px] leading-relaxed text-ink-2">
            ≈ ₩{Math.round(price * p.won).toLocaleString()} · {t("landing.perHour", { n: t("common.creditsN", { n: p.price30 }) })}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-semibold text-ink-2">{t("landing.screenNext")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.slots.length === 0 && <p className="text-[13px] text-ink-2">{t("landing.noSlots")}</p>}
            {p.slots.map((s, i) => (
              <span key={s.label + i} className={`tnum inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13.5px] font-semibold ${i === 0 ? "bg-brand text-white" : "bg-mist text-ink"}`}>
                {s.label}
                <span className={i === 0 ? "text-white/85" : "text-ink-2"}>{s.sub}</span>
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
