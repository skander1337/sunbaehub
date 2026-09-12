import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroScreen, type HeroScreenProps } from "../src/components/landing/HeroScreen";
import { I18nProvider } from "../src/lib/i18n/provider";
import { makeT, type Locale } from "../src/lib/i18n/dictionary";

const specialist: HeroScreenProps = {
  href: "/specialists/test-specialist",
  name: "테스트 선배",
  initial: "테",
  headline: "Portfolio feedback",
  verified: true,
  price: 247,
  multiplier: 1.37,
  reviewCount: 37,
  avgScore: 91,
  won: 100,
  price30: 125,
  slots: [{ label: "Mon 14:00", sub: "9/14" }],
};

for (const locale of ["ko", "en"] as const satisfies readonly Locale[]) {
  const t = makeT(locale);
  const render = (props: HeroScreenProps) => renderToStaticMarkup(
    <I18nProvider locale={locale}><HeroScreen {...props} /></I18nProvider>,
  );
  // Server HTML is the first view, even before hydration or in a throttled/background tab.
  const initial = render(specialist);
  assert.ok(initial.includes(t("common.creditsN", { n: specialist.price })));
  assert.ok(initial.includes(t("landing.reviewsN", { n: specialist.reviewCount })));
  assert.ok(initial.includes("1.37"));
  assert.ok(initial.includes(">91</span>"));
  assert.ok(initial.includes(t("landing.heroCardLabel", { name: specialist.name })));
  assert.ok(!initial.includes(t("landing.reviewsN", { n: 0 })));
  const empty = render({ ...specialist, slots: [], reviewCount: 0, avgScore: 0 });
  assert.ok(empty.includes(t("landing.noSlots")));
  assert.ok(empty.includes(t("landing.reviewsN", { n: 0 })));
  console.log(`PASS ${locale}: initial server HTML contains actual price/reputation, localized label, and empty availability`);
}
