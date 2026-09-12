import Link from "next/link";
import type { CSSProperties } from "react";
import { and, desc, eq } from "drizzle-orm";
import { Nav } from "@/components/Nav";
import { Deck } from "@/components/landing/Deck";
import { HeroScreen } from "@/components/landing/HeroScreen";
import { BookingFigure, LedgerFigure, LiveNowPanel, ReviewFigure, SessionFigure, type FigureDay, type LiveRow } from "@/components/landing/Figures";
import { SpecialistCard } from "@/components/SpecialistCard";
import { LocaleToggle } from "@/components/LocaleToggle";
import { IconArrow, IconCoin, IconShield, IconStar } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { db, schema } from "@/lib/db";
import { listSpecialists, getAvailabilityInputs } from "@/lib/queries/specialists";
import { computeSlots } from "@/lib/rules/slots";
import { CATEGORIES } from "@/lib/categories";
import { BRAND } from "@/lib/brand";
import { dayName, fmtTime, seoulDayKey, seoulParts } from "@/lib/seoul";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const DEMO_REVIEW_SCORE = 92;

export default async function LandingPage() {
  const { t, locale } = await getT();
  const now = new Date();
  const all = listSpecialists();
  const featured = [...all].sort((a, b) => b.reviewCount - a.reviewCount)[0] ?? null;
  const strip = all.filter((s) => s.ranked).slice(0, 4);
  const slotOpts = { days: 14, slotMin: 60, stepMin: BRAND.slotStepMinutes };
  const whenLabel = (d: Date) => {
    const p = seoulParts(d);
    return { label: `${dayName(p.dow, locale)} ${fmtTime(d)}`, sub: `${p.m + 1}/${p.d}` };
  };

  const slotDays = featured
    ? (() => {
        const { rules, busy } = getAvailabilityInputs(featured.id, now);
        return computeSlots(rules, busy, now, slotOpts);
      })()
    : [];
  const slots = slotDays
    .flatMap((d) => d.slots)
    .slice(0, 3)
    .map((s) => whenLabel(s.startAt));
  const todayKey = seoulDayKey(now);
  const figureDays: FigureDay[] = slotDays.slice(0, 5).map((d) => {
    const p = seoulParts(d.dayStart);
    return { dayName: dayName(d.dow, locale), dateLabel: `${p.m + 1}/${p.d}`, isToday: d.dateKey === todayKey, times: d.slots.map((s) => fmtTime(s.startAt)) };
  });

  // The best visible review of the featured sunbae, quoted on the product screen with its score.
  const review = featured
    ? (db
        .select({ score: schema.reviews.score, body: schema.reviews.body })
        .from(schema.reviews)
        .where(and(eq(schema.reviews.specialistId, featured.id), eq(schema.reviews.status, "visible")))
        .orderBy(desc(schema.reviews.score), desc(schema.reviews.createdAt))
        .limit(1)
        .get() ?? null)
    : null;

  // Who else has an open time soon, from the same slot rules as checkout.
  const live: LiveRow[] = strip
    .filter((s) => s.id !== featured?.id)
    .map((s) => {
      const { rules, busy } = getAvailabilityInputs(s.id, now);
      const first = computeSlots(rules, busy, now, slotOpts).flatMap((d) => d.slots)[0];
      if (!first) return null;
      const w = whenLabel(first.startAt);
      return { id: s.id, name: s.name, initial: s.name.slice(0, 1), next: `${w.label} · ${w.sub}`, price: s.pricing.price };
    })
    .filter((r): r is LiveRow => r !== null)
    .slice(0, 3);

  const rules3 = [
    { icon: IconStar, title: t("landing.rule1"), desc: t("landing.rule1d") },
    { icon: IconShield, title: t("landing.rule2"), desc: t("landing.rule2d") },
    { icon: IconCoin, title: t("landing.rule3"), desc: t("landing.rule3d") },
  ];
  const steps = [
    { title: t("landing.how1"), desc: t("landing.how1d") },
    { title: t("landing.how2"), desc: t("landing.how2d") },
    { title: t("landing.how3"), desc: t("landing.how3d") },
  ];
  const figures = featured
    ? [
        <BookingFigure key="book" t={t} locale={locale} days={figureDays} price={featured.pricing.price} />,
        <SessionFigure key="session" t={t} locale={locale} name={featured.name} initial={featured.name.slice(0, 1)} />,
        <ReviewFigure
          key="review"
          t={t}
          locale={locale}
          score={DEMO_REVIEW_SCORE}
          name={featured.name}
          reviewCount={featured.reviewCount}
          avgScore={featured.avgScore}
          basePrice={featured.basePrice}
        />,
      ]
    : [];
  const creditRows = [
    { k: t("landing.creditsRow1"), v: t("landing.creditsRow1d"), tone: "text-ink" },
    { k: t("landing.creditsRow2"), v: t("landing.creditsRow2d"), tone: "text-success" },
    { k: t("landing.creditsRow3"), v: t("landing.creditsRow3d"), tone: "text-danger" },
    { k: t("landing.creditsRow4"), v: t("landing.creditsRow4d"), tone: "text-brand" },
  ];

  return (
    <Deck>
      {/* Card 1: the indigo field, with the real product screen rising through its lower edge */}
      <section className="deck-card">
        <div className="bg-brand text-white">
          <Nav tone="brand" />
          <div className={`container-x pt-14 sm:pt-20 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-14 ${featured ? "pb-56 sm:pb-64" : "pb-20 sm:pb-28"}`}>
            <div>
              <h1 className="max-w-[16ch] text-[40px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-[56px] lg:text-[64px]">
                <span className="hero-mask">
                  <span className="hero-line">{t("landing.headline1")}</span>
                </span>
                <span className="hero-mask">
                  <span className="hero-line">{t("landing.headline2")}</span>
                </span>
              </h1>
              <p className="hero-in mt-6 max-w-[42ch] text-[17px] leading-relaxed text-white/80 sm:text-[19px]" style={delay(220)}>
                {t("landing.sub")}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/specialists" className="hero-in btn btn-lg btn-on-brand" style={delay(320)}>
                  {t("landing.findSunbae")}
                  <IconArrow size={18} />
                </Link>
                <Link href="/signup?role=expert" className="hero-in btn btn-lg btn-outline-on-brand" style={delay(390)}>
                  {t("landing.becomeSunbae")}
                </Link>
              </div>
              <ul className="mt-12 grid max-w-[880px] gap-x-8 gap-y-4 sm:grid-cols-3">
                {rules3.map(({ icon: Icon, title, desc }, i) => (
                  <li key={title} className="hero-in flex items-start gap-3" style={delay(480 + i * 80)}>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-white">
                      <Icon size={15} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="text-[15px] font-semibold">{title}</div>
                      <div className="mt-0.5 text-[13.5px] leading-snug text-white/75">{desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {live.length > 0 && (
              <div className="hero-in hidden lg:mt-2 lg:block" style={delay(520)}>
                <LiveNowPanel t={t} rows={live} href="/specialists" />
              </div>
            )}
          </div>
        </div>
        {featured && (
          <div className="container-x -mt-44 pb-14 sm:-mt-52 sm:pb-20">
            <HeroScreen
              href={`/specialists/${featured.id}`}
              name={featured.name}
              initial={featured.name.slice(0, 1)}
              headline={featured.headline}
              verified={featured.verification === "verified"}
              basePrice={featured.basePrice}
              price={featured.pricing.price}
              multiplier={featured.pricing.multiplier}
              reviewCount={featured.reviewCount}
              avgScore={featured.avgScore}
              won={BRAND.creditsToWon}
              price30={featured.price30}
              slots={slots}
              review={review}
            />
          </div>
        )}
      </section>

      {/* Card 2: how it works, each step with the real screen it happens on */}
      <section className="deck-card">
        <div className="container-x flex flex-1 flex-col justify-center py-20 sm:py-24">
          <h2 className="reveal h2 text-[26px] sm:text-[32px]">{t("landing.howTitle")}</h2>
          <ol className="reveal-list mt-8 grid gap-10 sm:mt-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((s, i) => (
              <li key={s.title} className="flex flex-col border-t border-ink pt-5">
                <div className="tnum text-[13px] font-bold text-ink-3">{i + 1}</div>
                <div className="mt-2 text-[19px] font-bold tracking-[-0.015em] sm:text-[20px]">{s.title}</div>
                <p className="muted mt-2 text-[15px] leading-relaxed">{s.desc}</p>
                {figures[i] && <div className="mt-6 min-h-[300px] flex-1">{figures[i]}</div>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Card 3: what you need, and who can take it now */}
      <section className="deck-card">
        <div className="container-x flex flex-1 flex-col justify-center py-20 sm:py-24">
          <h2 className="reveal h2 text-[26px] sm:text-[30px]">{t("landing.catTitle")}</h2>
          <div className="reveal-list mt-6 flex flex-wrap gap-2.5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.id}
                href={`/specialists?category=${c.id}`}
                className="inline-flex h-11 items-center rounded-[12px] bg-mist px-4 text-[15px] font-semibold text-ink transition-colors duration-200 hover:bg-brand-tint hover:text-brand-deep"
              >
                {c[locale]}
              </Link>
            ))}
          </div>
          {strip.length > 0 && (
            <div className="mt-20 sm:mt-24">
              <div className="reveal flex items-end justify-between gap-4">
                <div>
                  <h2 className="h2 text-[26px] sm:text-[30px]">{t("landing.stripTitle")}</h2>
                  <p className="mt-2 text-[13px] text-ink-3">{t("landing.demoNote")}</p>
                </div>
                <Link href="/specialists" className="btn btn-sm btn-outline shrink-0">
                  {t("landing.stripAll")}
                </Link>
              </div>
              <div className="reveal-list mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {strip.map((s) => (
                  <div key={s.id} className="h-full">
                    <SpecialistCard s={s} locale={locale} t={t} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Card 4: how credits move, with one session's ledger beside the rules */}
      <section className="deck-card">
        <div className="container-x flex flex-1 flex-col justify-center py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
            <div>
              <h2 className="reveal h2 text-[26px] sm:text-[30px]">{t("landing.creditsTitle")}</h2>
              <dl className="reveal-list mt-6 divide-y divide-line border-y border-line">
                {creditRows.map((r) => (
                  <div key={r.k} className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
                    <dt className={`text-[16px] font-bold ${r.tone}`}>{r.k}</dt>
                    <dd className="text-[16px] text-ink-2">{r.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {featured && (
              <div className="reveal">
                <LedgerFigure t={t} price={featured.pricing.price} seeker={t("landing.party.seeker")} sunbae={featured.name} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Card 5: the indigo close, holding the two actions, and the footer */}
      <section className="deck-card deck-card--brand text-white">
        <div className="container-x flex flex-1 flex-col">
          <div className="reveal-list grid flex-1 content-center gap-4 py-20 sm:grid-cols-2 sm:py-24">
            <div className="rounded-[16px] bg-paper p-7 text-ink sm:p-9">
              <h2 className="text-[22px] font-bold tracking-[-0.015em] sm:text-[24px]">{t("landing.closeSeekerT")}</h2>
              <p className="muted mt-2 text-[15px] leading-relaxed">{t("landing.closeSeekerD")}</p>
              <Link href="/specialists" className="btn btn-primary mt-6">
                {t("landing.findSunbae")}
                <IconArrow size={18} />
              </Link>
            </div>
            <div className="rounded-[16px] border border-white/30 p-7 sm:p-9">
              <h2 className="text-[22px] font-bold tracking-[-0.015em] sm:text-[24px]">{t("landing.closeSunbaeT")}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/80">{t("landing.closeSunbaeD")}</p>
              <Link href="/signup?role=expert" className="btn btn-on-brand mt-6">
                {t("landing.becomeSunbae")}
                <IconArrow size={18} />
              </Link>
            </div>
          </div>
          <footer className="mt-auto border-t border-white/20 pt-8 pb-8">
            <div className="flex flex-col gap-3 text-[13px] text-white/75 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[16px] font-extrabold tracking-[-0.03em] text-white">{BRAND.nameKo}</span>
                <span className="font-semibold text-white/90">{BRAND.name}</span>
                <span className="ml-2">{t("footer.tag")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>{t("landing.demoNote")}</span>
                <LocaleToggle tone="brand" />
              </div>
            </div>
          </footer>
        </div>
      </section>
    </Deck>
  );
}
