import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSpecialistCard, getAvailabilityInputs, listSpecialists } from "@/lib/queries/specialists";
import { computeSlots } from "@/lib/rules/slots";
import { categoryLabel } from "@/lib/categories";
import { BRAND } from "@/lib/brand";
import { dayName, fmtDate, fmtTime, seoulDayKey, seoulParts } from "@/lib/seoul";
import { SlotPicker, type PickerDay } from "@/components/SlotPicker";
import { FormError } from "@/components/FormError";
import { IconCheck, IconFlag } from "@/components/icons";

export default async function SpecialistPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [{ t, locale }, user] = await Promise.all([getT(), currentUser()]);
  const card = getSpecialistCard(id);
  if (!card) notFound();
  const profile = db.select().from(schema.specialistProfiles).where(eq(schema.specialistProfiles.userId, id)).get()!;
  const now = new Date();

  const rankIdx = listSpecialists().filter((s) => s.ranked).findIndex((s) => s.id === id);
  const { rules, busy } = getAvailabilityInputs(id, now);
  const days: PickerDay[] = computeSlots(rules, busy, now).map((d) => {
    const p = seoulParts(d.dayStart);
    return {
      dateKey: d.dateKey,
      dayName: dayName(p.dow, locale),
      dateLabel: String(p.d),
      isToday: d.dateKey === seoulDayKey(now),
      slots: d.slots.map((s) => ({ iso: s.startAt.toISOString(), time: fmtTime(s.startAt) })),
    };
  });

  const canSeeFlagged = !!user && (user.id === id || user.isAdmin);
  const reviews = db
    .select({ r: schema.reviews, reviewer: schema.users.name })
    .from(schema.reviews)
    .innerJoin(schema.users, eq(schema.users.id, schema.reviews.reviewerId))
    .where(and(eq(schema.reviews.specialistId, id), inArray(schema.reviews.status, canSeeFlagged ? ["visible", "flagged"] : ["visible"])))
    .orderBy(desc(schema.reviews.createdAt))
    .all();
  const posts = db.select().from(schema.posts).where(eq(schema.posts.authorId, id)).orderBy(desc(schema.posts.createdAt)).all();
  const isOwn = user?.id === id;
  const verified = card.verification === "verified";

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="min-w-0 lg:order-1">
        <div className="flex items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[22px] font-bold text-brand">{card.name.slice(0, 1)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{card.name}</h1>
              {verified ? (
                <span className="tag tag-brand gap-0.5">
                  <IconCheck size={12} strokeWidth={2.5} />
                  {t("common.verified")}
                </span>
              ) : (
                <span className="tag tag-warn">{t("common.pending")}</span>
              )}
              {rankIdx >= 0 && <span className="tag tag-neutral">{t("profile.rankedAt", { n: rankIdx + 1 })}</span>}
            </div>
            <p className="muted mt-1 text-[16px]">{card.headline}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.categories.map((c) => (
                <Link key={c} href={`/specialists?category=${c}`} className="tag tag-neutral font-medium hover:bg-brand-tint hover:text-brand-deep">
                  {categoryLabel(c, locale)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-line py-5">
          <div>
            <dt className="text-[12px] font-semibold text-ink-3">{t("leaderboard.avg")}</dt>
            <dd className="tnum mt-1 text-[22px] font-extrabold">{card.reviewCount ? Math.round(card.avgScore) : "–"}<span className="text-[13px] font-semibold text-ink-3">/100</span></dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-ink-3">{t("leaderboard.reviews")}</dt>
            <dd className="tnum mt-1 text-[22px] font-extrabold">{card.reviewCount}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-ink-3">{t("leaderboard.score")}</dt>
            <dd className="tnum mt-1 text-[22px] font-extrabold">{card.ranked ? card.rankScore.toFixed(1) : "–"}</dd>
          </div>
        </dl>

        <section className="mt-8">
          <h2 className="h3">{t("profile.about")}</h2>
          <p className="mt-2 max-w-[68ch] text-[15.5px] leading-relaxed text-ink-2">{profile.bio}</p>
        </section>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="h3">{t("profile.education")}</h2>
            <ul className="mt-3 space-y-3">
              {profile.education.map((e, i) => (
                <li key={i} className="text-[15px]">
                  <div className="font-semibold">{e.school}</div>
                  <div className="muted text-[14px]">{e.major} · {e.degree} · <span className="tnum">{e.years}</span></div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="h3">{t("profile.experience")}</h2>
            <ul className="mt-3 space-y-3">
              {profile.experience.map((e, i) => (
                <li key={i} className="text-[15px]">
                  <div className="font-semibold">{e.company}</div>
                  <div className="muted text-[14px]">{e.title} · <span className="tnum">{e.years}</span></div>
                </li>
              ))}
            </ul>
            {profile.resumePath && user && (
              <a href={`/api/files/resume/${id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline mt-4">
                {t("profile.resume")}
              </a>
            )}
          </section>
        </div>

        <section className="mt-10">
          <h2 className="h3">{t("profile.posts")}</h2>
          {posts.length === 0 ? (
            <p className="muted mt-2 text-[14px]">{t("profile.noPosts")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} className="flex items-center justify-between gap-4 py-3 text-[15px] font-semibold hover:text-brand-deep">
                    <span className="truncate">{p.title}</span>
                    <span className="tnum shrink-0 text-[13px] font-medium text-ink-3">{fmtDate(p.createdAt, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="h3">
            {t("profile.reviews")} <span className="tnum text-ink-3">{card.reviewCount}</span>
          </h2>
          {reviews.length === 0 ? (
            <p className="muted mt-2 text-[14px]">{t("profile.noReviews")}</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {reviews.map(({ r, reviewer }) => (
                <li key={r.id} className={`border-t border-line pt-4 ${r.status === "flagged" ? "opacity-70" : ""}`}>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="tnum text-[16px] font-extrabold">{r.score}</span>
                    <span className="text-ink-3">/100</span>
                    <span className="muted">· {reviewer.slice(0, 1)}**</span>
                    <span className="tnum text-ink-3">· {fmtDate(r.createdAt, locale)}</span>
                    {r.status === "flagged" && (
                      <span className="tag tag-warn gap-1">
                        <IconFlag size={12} />
                        {t("profile.flagged")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="order-first min-w-0 lg:order-2 lg:sticky lg:top-6 lg:self-start">
        <div className="card min-w-0 p-6">
          <FormError code={error} />
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[13px] font-semibold text-ink-3">{t("profile.priceTitle")}</div>
              <div className="tnum mt-1 text-[30px] leading-none font-extrabold tracking-[-0.03em]">{t("common.creditsN", { n: card.pricing.price })}</div>
            </div>
            <div className="tnum text-right text-[12.5px] text-ink-3">≈ ₩{(card.pricing.price * BRAND.creditsToWon).toLocaleString()}</div>
          </div>
          <p className="tnum mt-2 text-[13px] text-ink-2">{card.note[locale]}</p>
          <div className="hairline mt-5 pt-5">
            {!verified ? (
              <p className="muted text-[14px]">{t("profile.pending")}</p>
            ) : isOwn ? (
              <p className="muted text-[14px]">{t("error.own_profile")}</p>
            ) : (
              <SlotPicker
                specialistId={id}
                days={days}
                price={card.pricing.price}
                balance={user ? user.creditBalance : null}
                categories={card.categories.map((c) => ({ id: c, label: categoryLabel(c, locale) }))}
                loginHref={`/login?next=${encodeURIComponent(`/specialists/${id}`)}`}
              />
            )}
          </div>
        </div>
        <ul className="mt-4 space-y-2 px-1 text-[12.5px] leading-relaxed text-ink-3">
          <li>{t("profile.cancelRule")}</li>
          <li>{t("profile.refundRule")}</li>
        </ul>
      </aside>
    </div>
  );
}
