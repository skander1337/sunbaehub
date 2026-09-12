import Link from "next/link";
import type { Locale, TFn } from "@/lib/i18n/dictionary";
import { IconArrow, IconPaperclip, IconSend } from "@/components/icons";
import { translate } from "@/lib/translate";
import { priceFor } from "@/lib/rules/pricing";
import { normalSettlement, refundSplit } from "@/lib/rules/refund";

/**
 * Static figures of the real product for the landing deck. Each mirrors the markup of the screen it depicts
 * (slot picker, session room, review score, credit ledger) and is fed real data: the featured sunbae's next
 * days and times, the demo phrase map's own translations, and the pricing and refund rules' actual outputs.
 */

type Common = { t: TFn; locale: Locale };

export type FigureDay = { dayName: string; dateLabel: string; isToday: boolean; times: string[] };

export function BookingFigure({ t, days, price, durationMin = 60 }: Common & { days: FigureDay[]; price: number; durationMin?: number }) {
  const active = Math.max(
    0,
    days.findIndex((d) => d.times.length > 0),
  );
  const day = days[active];
  return (
    <div className="card flex h-full flex-col p-4" aria-hidden="true">
      <div className="text-[13px] font-semibold text-ink-2">{t("profile.pickDay")}</div>
      <div className="mt-2 flex gap-1.5">
        {days.slice(0, 5).map((d, i) => (
          <span
            key={`${d.dayName}-${d.dateLabel}`}
            className={`flex w-[52px] flex-col items-center rounded-[12px] px-1 py-1.5 text-center ${
              i === active ? "bg-ink text-white" : d.times.length ? "bg-mist text-ink" : "text-ink-2"
            }`}
          >
            <span className="text-[13px] font-medium">{d.isToday ? t("profile.today") : d.dayName}</span>
            <span className="tnum text-[14px] font-bold">{d.dateLabel}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 text-[13px] font-semibold text-ink-2">{t("profile.pickTime")}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(day?.times ?? []).slice(0, 4).map((time, i) => (
          <span
            key={time}
            className={`tnum inline-flex h-9 items-center rounded-[12px] px-3 text-[13.5px] font-semibold ${
              i === 0 ? "bg-brand text-white" : "border border-line bg-paper text-ink"
            }`}
          >
            {time}
          </span>
        ))}
      </div>
      <div className="mt-auto border-t border-line pt-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="muted">{t("profile.sessionN", { n: durationMin })}</span>
          <span className="tnum font-bold">{t("common.creditsN", { n: price })}</span>
        </div>
        <div className="mt-1 text-[13px] text-ink-2">{t("landing.fig.holdNote")}</div>
        <span className="btn btn-primary btn-sm mt-3 w-full">
          {t("profile.book")}
          <IconArrow size={16} />
        </span>
      </div>
    </div>
  );
}

export function SessionFigure({ t, name, initial }: Common & { name: string; initial: string }) {
  const koLine = "첫 문장은 결론부터 쓰는 게 좋아요.";
  const enLine = "Could you look at my resume?";
  const koToEn = translate(koLine, "ko", "en").text;
  const enToKo = translate(enLine, "en", "ko").text;
  return (
    <div className="card flex h-full flex-col overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-bold text-brand">{initial}</span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] leading-tight font-bold">{name}</div>
            <div className="text-[13px] text-ink-2">{t("session.title")}</div>
          </div>
        </div>
        <span className="tag tag-brand tnum shrink-0">{t("session.endsIn")} 41:20</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex justify-start">
          <div className="flex max-w-[88%] flex-col items-start">
            <div className="rounded-[16px] rounded-bl-[6px] bg-mist px-3.5 py-2 text-[13.5px] leading-relaxed text-ink">{koLine}</div>
            <div className="mt-1 text-[13px] text-ink-2">
              {t("common.autoTranslated")} · <span className="text-ink-2">{koToEn}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="flex max-w-[88%] flex-col items-end">
            <div className="rounded-[16px] rounded-br-[6px] bg-brand px-3.5 py-2 text-[13.5px] leading-relaxed text-white">{enLine}</div>
            <div className="mt-1 text-right text-[13px] text-ink-2">
              {t("common.autoTranslated")} · <span className="text-ink-2">{enToKo}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-start">
          <span className="inline-flex items-center gap-1 rounded-[16px] rounded-bl-[6px] bg-mist px-3.5 py-3">
            <i className="h-1.5 w-1.5 rounded-full bg-ink-3" />
            <i className="h-1.5 w-1.5 rounded-full bg-ink-3/70" />
            <i className="h-1.5 w-1.5 rounded-full bg-ink-3/40" />
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-2">
          <IconPaperclip size={16} />
        </span>
        <span className="flex h-9 min-w-0 flex-1 items-center truncate rounded-[12px] border border-line px-3 text-[13px] text-ink-2">{t("session.placeholder")}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-brand text-white">
          <IconSend size={16} />
        </span>
      </div>
    </div>
  );
}

export function ReviewFigure({
  t,
  score,
  name,
  reviewCount,
  avgScore,
  basePrice,
}: Common & { score: number; name: string; reviewCount: number; avgScore: number; basePrice: number }) {
  const n = reviewCount + 1;
  const avg = (avgScore * reviewCount + score) / n;
  const after = priceFor(basePrice, n, avg);
  const hint = score >= 90 ? t("review.h.great") : score >= 75 ? t("review.h.good") : score >= 60 ? t("review.h.ok") : t("review.h.bad");
  return (
    <div className="card flex h-full flex-col p-4" aria-hidden="true">
      <div className="text-[13px] font-semibold text-ink-2">{t("review.score")}</div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="tnum text-[40px] leading-none font-extrabold tracking-[-0.03em]">
          {score}
          <span className="text-[15px] font-semibold text-ink-2">/100</span>
        </span>
        <span className={`text-[13px] font-semibold ${score >= 75 ? "text-success-ink" : score >= 60 ? "text-ink-2" : "text-danger"}`}>{hint}</span>
      </div>
      <div className="relative mt-5 h-2 w-full rounded-full bg-mist">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${score}%` }} />
        <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-paper" style={{ left: `${score}%` }} />
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[13px] text-ink-2">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      <div className="mt-auto border-t border-line pt-3 text-[13px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{name}</span> · {t("landing.fig.reviewNote", { n, avg: Math.round(avg), m: after.multiplier.toFixed(2) })}
      </div>
    </div>
  );
}

function LedgerRow({ label, party, amount, tone }: { label: string; party: string; amount: number; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{label}</div>
        <div className="text-[13px] text-ink-2">{party}</div>
      </div>
      <div className={`tnum shrink-0 text-[15px] font-bold ${tone}`}>
        {amount > 0 ? "+" : ""}
        {amount.toLocaleString()}
      </div>
    </div>
  );
}

export function LedgerFigure({ t, price, seeker, sunbae }: { t: TFn; price: number; seeker: string; sunbae: string }) {
  const normal = normalSettlement(price);
  const split = refundSplit(price);
  const platform = t("landing.party.platform");
  return (
    <div className="card p-5 sm:p-6" aria-hidden="true">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-semibold text-ink-2">{t("landing.fig.ledgerTitle")}</div>
        <div className="tnum text-[13px] font-bold">{t("common.creditsN", { n: price })}</div>
      </div>
      <div className="mt-3 border-y border-line">
        <LedgerRow label={t("tx.booking_hold")} party={seeker} amount={-price} tone="text-ink" />
      </div>
      <div className="mt-4 text-[13px] font-semibold text-success-ink">{t("landing.creditsRow2")}</div>
      <div className="mt-1 divide-y divide-line border-y border-line">
        <LedgerRow label={t("tx.booking_release")} party={sunbae} amount={normal.specialistPayout} tone="text-success-ink" />
        <LedgerRow label={t("tx.platform_fee")} party={platform} amount={normal.platformFee} tone="text-ink-2" />
      </div>
      <div className="mt-4 text-[13px] font-semibold text-danger">{t("landing.creditsRow3")}</div>
      <div className="mt-1 divide-y divide-line border-y border-line">
        <LedgerRow label={t("tx.booking_refund")} party={seeker} amount={split.seekerRefund} tone="text-brand" />
        <LedgerRow label={t("tx.booking_release")} party={sunbae} amount={split.specialistPayout} tone="text-success-ink" />
        <LedgerRow label={t("tx.platform_fee")} party={platform} amount={split.platformFee} tone="text-ink-2" />
      </div>
    </div>
  );
}

export type LiveRow = { id: string; name: string; initial: string; next: string; price: number };

/** On the indigo field: who has the next open times, from the same slot rules as checkout. */
export function LiveNowPanel({ t, rows, href }: { t: TFn; rows: LiveRow[]; href: string }) {
  return (
    <div className="rounded-[16px] bg-white/10 p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-white/85">{t("landing.liveTitle")}</div>
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-white/85 transition-colors duration-200 hover:text-white">
          {t("landing.stripAll")}
          <IconArrow size={14} />
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-white/15">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/specialists/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-3 transition-colors duration-200 hover:bg-white/10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[14px] font-bold">{r.initial}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{r.name}</div>
                <div className="tnum text-[12.5px] text-white/70">{r.next}</div>
              </div>
              <div className="tnum shrink-0 text-[14px] font-bold">{t("common.creditsN", { n: r.price })}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
