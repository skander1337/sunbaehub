import Link from "next/link";
import type { SpecialistCardData } from "@/lib/queries/specialists";
import type { Locale, TFn } from "@/lib/i18n/dictionary";
import { categoryLabel } from "@/lib/categories";
import { IconCheck } from "./icons";

export function SpecialistCard({ s, locale, t, rank }: { s: SpecialistCardData; locale: Locale; t: TFn; rank?: number }) {
  return (
    <Link
      href={`/specialists/${s.id}`}
      className="card group flex h-full flex-col gap-4 p-5 transition-[border-color,background-color] duration-200 hover:border-brand/60"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[16px] font-bold text-brand">
          {s.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rank !== undefined && <span className="tnum text-[13px] font-bold text-ink-3">{rank}</span>}
            <span className="truncate text-[16px] font-bold">{s.name}</span>
            {s.verification === "verified" && (
              <span className="tag tag-brand gap-0.5">
                <IconCheck size={12} strokeWidth={2.5} />
                {t("card.verified")}
              </span>
            )}
          </div>
          <p className="muted mt-0.5 line-clamp-1 text-[13.5px]">{s.headline}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {s.categories.map((c) => (
          <span key={c} className="tag tag-neutral font-medium">
            {categoryLabel(c, locale)}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
        <div className="text-[13px] text-ink-2">
          {s.reviewCount > 0 ? (
            <>
              <span className="tnum font-semibold text-ink">{Math.round(s.avgScore)}</span>
              <span className="text-ink-3">/100 · </span>
              <span className="tnum">{t("landing.reviewsN", { n: s.reviewCount })}</span>
            </>
          ) : (
            <span className="text-ink-3">{t("card.newSunbae")}</span>
          )}
        </div>
        <div className="text-right">
          <div className="tnum text-[18px] font-extrabold tracking-[-0.02em]">{t("common.creditsN", { n: s.pricing.price })}</div>
          <div className="tnum text-[12px] text-ink-3">{s.pricing.multiplier > 1 ? `×${s.pricing.multiplier.toFixed(2)}` : t("card.base")}</div>
        </div>
      </div>
    </Link>
  );
}
