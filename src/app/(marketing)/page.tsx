import Link from "next/link";
import { Nav } from "@/components/Nav";
import { HeroScreen } from "@/components/landing/HeroScreen";
import { SpecialistCard } from "@/components/SpecialistCard";
import { Reveal } from "@/components/Reveal";
import { LocaleToggle } from "@/components/LocaleToggle";
import { IconArrow, IconCoin, IconShield, IconStar } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { listSpecialists, getAvailabilityInputs } from "@/lib/queries/specialists";
import { computeSlots } from "@/lib/rules/slots";
import { CATEGORIES } from "@/lib/categories";
import { BRAND } from "@/lib/brand";
import { dayName, fmtTime, seoulParts } from "@/lib/seoul";

export default async function LandingPage() {
  const { t, locale } = await getT();
  const now = new Date();
  const all = listSpecialists({ verifiedOnly: true });
  const featured = [...all].sort((a, b) => b.reviewCount - a.reviewCount)[0];
  const strip = all.filter((s) => s.ranked).slice(0, 4);

  const { rules, busy } = getAvailabilityInputs(featured.id, now);
  const slots = computeSlots(rules, busy, now, { days: 14 })
    .flatMap((d) => d.slots)
    .slice(0, 3)
    .map((s) => {
      const p = seoulParts(s.startAt);
      return { label: `${dayName(p.dow, locale)} ${fmtTime(s.startAt)}`, sub: `${p.m + 1}/${p.d}` };
    });

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
  const creditRows = [
    { k: t("landing.creditsRow1"), v: t("landing.creditsRow1d"), tone: "text-ink" },
    { k: t("landing.creditsRow2"), v: t("landing.creditsRow2d"), tone: "text-success" },
    { k: t("landing.creditsRow3"), v: t("landing.creditsRow3d"), tone: "text-danger" },
    { k: t("landing.creditsRow4"), v: t("landing.creditsRow4d"), tone: "text-brand" },
  ];

  return (
    <>
      {/* Indigo field: nav + hero copy */}
      <section className="bg-brand text-white">
        <Nav tone="brand" />
        <div className="container-x pt-14 pb-56 sm:pt-20 sm:pb-64">
          <h1 className="max-w-[16ch] text-[40px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-[56px] lg:text-[64px]">
            {t("landing.headline1")}
            <br />
            {t("landing.headline2")}
          </h1>
          <p className="mt-6 max-w-[42ch] text-[17px] leading-relaxed text-white/80 sm:text-[19px]">{t("landing.sub")}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/specialists" className="btn btn-lg btn-on-brand">
              {t("landing.findSunbae")}
              <IconArrow size={18} />
            </Link>
            <Link href="/signup?role=expert" className="btn btn-lg btn-outline-on-brand">
              {t("landing.becomeSunbae")}
            </Link>
          </div>
          <ul className="mt-12 grid max-w-[880px] gap-x-8 gap-y-4 sm:grid-cols-3">
            {rules3.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
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
      </section>

      {/* The real product screen rising through the field's edge */}
      <div className="container-x -mt-44 sm:-mt-52">
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
          slots={slots}
        />
      </div>

      {/* How it works */}
      <section className="container-x pt-24 sm:pt-32">
        <Reveal>
          <h2 className="h2 text-[26px] sm:text-[30px]">{t("landing.howTitle")}</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t border-ink pt-5">
                <div className="tnum text-[13px] font-bold text-ink-3">{i + 1}</div>
                <div className="mt-2 text-[18px] font-bold tracking-[-0.01em]">{s.title}</div>
                <p className="muted mt-2 text-[15px] leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Categories */}
      <section className="container-x pt-20 sm:pt-24">
        <Reveal>
          <h2 className="h2 text-[26px] sm:text-[30px]">{t("landing.catTitle")}</h2>
          <div className="mt-6 flex flex-wrap gap-2.5">
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
        </Reveal>
      </section>

      {/* Specialists strip */}
      <section className="container-x pt-20 sm:pt-24">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="h2 text-[26px] sm:text-[30px]">{t("landing.stripTitle")}</h2>
              <p className="mt-2 text-[13px] text-ink-3">{t("landing.demoNote")}</p>
            </div>
            <Link href="/specialists" className="btn btn-sm btn-outline shrink-0">
              {t("landing.stripAll")}
            </Link>
          </div>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {strip.map((s) => (
            <Reveal key={s.id} className="h-full">
              <SpecialistCard s={s} locale={locale} t={t} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Credits explainer */}
      <section className="container-x pt-20 sm:pt-24">
        <Reveal>
          <h2 className="h2 text-[26px] sm:text-[30px]">{t("landing.creditsTitle")}</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {creditRows.map((r) => (
              <div key={r.k} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                <dt className={`text-[15px] font-bold ${r.tone}`}>{r.k}</dt>
                <dd className="text-[15px] text-ink-2">{r.v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* Two-path close */}
      <section className="container-x pt-20 pb-24 sm:pt-24 sm:pb-32">
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-7 sm:p-9">
              <h3 className="text-[22px] font-bold tracking-[-0.015em]">{t("landing.closeSeekerT")}</h3>
              <p className="muted mt-2 text-[15px] leading-relaxed">{t("landing.closeSeekerD")}</p>
              <Link href="/specialists" className="btn btn-primary mt-6">
                {t("landing.findSunbae")}
                <IconArrow size={18} />
              </Link>
            </div>
            <div className="rounded-[16px] bg-brand p-7 text-white sm:p-9">
              <h3 className="text-[22px] font-bold tracking-[-0.015em]">{t("landing.closeSunbaeT")}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/80">{t("landing.closeSunbaeD")}</p>
              <Link href="/signup?role=expert" className="btn btn-on-brand mt-6">
                {t("landing.becomeSunbae")}
                <IconArrow size={18} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="container-x flex flex-col gap-3 py-8 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[16px] font-extrabold tracking-[-0.03em] text-ink">{BRAND.nameKo}</span>
            <span className="font-semibold">{BRAND.name}</span>
            <span className="ml-2">{t("footer.tag")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{t("landing.demoNote")}</span>
            <LocaleToggle />
          </div>
        </div>
      </footer>
    </>
  );
}
