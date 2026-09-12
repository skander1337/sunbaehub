import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSpecialistCard, listSpecialists } from "@/lib/queries/specialists";
import { categoryLabel } from "@/lib/categories";
import { fmtDateTime, fmtRelativeDay } from "@/lib/seoul";
import { FRAUD_RULE_LABELS, type FraudRule } from "@/lib/rules/fraud";
import { cancelBooking } from "@/app/actions/booking";
import { resubmitForReview } from "@/app/actions/specialist";
import { isProfileComplete } from "@/lib/services/admin";
import { StatusTag } from "@/components/StatusTag";
import { Notice } from "@/components/Notice";
import { FormError } from "@/components/FormError";
import { IconArrow } from "@/components/icons";
import type { DictKey } from "@/lib/i18n/dictionary";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ requested?: string; submitted?: string; error?: string }> }) {
  const sp = await searchParams;
  const [{ user, profile }, { t, locale }] = await Promise.all([requireSpecialist(), getT()]);
  const card = getSpecialistCard(user.id)!;
  const now = new Date();
  const rankIdx = listSpecialists().filter((s) => s.ranked).findIndex((s) => s.id === user.id);

  const rows = db
    .select({ b: schema.bookings, seeker: schema.users.name, affiliation: schema.users.affiliation })
    .from(schema.bookings)
    .innerJoin(schema.users, eq(schema.users.id, schema.bookings.seekerId))
    .where(eq(schema.bookings.specialistId, user.id))
    .orderBy(desc(schema.bookings.startAt))
    .all();
  const upcoming = rows.filter((r) => r.b.status === "confirmed" || r.b.status === "in_progress").sort((a, b) => a.b.startAt.getTime() - b.b.startAt.getTime());
  const recent = rows.filter((r) => !(r.b.status === "confirmed" || r.b.status === "in_progress")).slice(0, 6);
  const reviewByBooking = new Map(db.select().from(schema.reviews).where(eq(schema.reviews.specialistId, user.id)).all().map((r) => [r.bookingId, r]));
  const flagged = db
    .select({ r: schema.reviews, f: schema.reviewFlags })
    .from(schema.reviews)
    .innerJoin(schema.reviewFlags, eq(schema.reviewFlags.reviewId, schema.reviews.id))
    .where(and(eq(schema.reviews.specialistId, user.id), eq(schema.reviews.status, "flagged"), eq(schema.reviewFlags.status, "open")))
    .all();

  const vKey = `dash.v.${profile.verification}` as DictKey;
  const vTone = profile.verification === "verified" ? "tag-brand" : profile.verification === "pending" ? "tag-warn" : profile.verification === "rejected" ? "tag-danger" : "tag-neutral";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{t("dash.title")}</h1>
          <p className="muted mt-1 text-[15px]">
            {user.name} · {profile.headline}
          </p>
        </div>
        <Link href={`/specialists/${user.id}`} className="btn btn-sm btn-outline">
          {t("nav.specialists")} <IconArrow size={16} />
        </Link>
      </div>
      <div className="mt-6">
        {(sp.requested || sp.submitted) && <Notice tone="info">{t("onboarding.submitted")}</Notice>}
        <FormError code={sp.error} />
      </div>

      <dl className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5">
          <dt className="text-[12.5px] font-semibold text-ink-3">{t("dash.balance")}</dt>
          <dd className="tnum mt-1 text-[24px] font-extrabold tracking-[-0.02em]">{user.creditBalance.toLocaleString()}</dd>
        </div>
        <div className="card p-5">
          <dt className="text-[12.5px] font-semibold text-ink-3">{t("dash.price")}</dt>
          <dd className="tnum mt-1 text-[24px] font-extrabold tracking-[-0.02em]">{card.pricing.price}</dd>
          <dd className="tnum mt-0.5 text-[12px] text-ink-3">{card.note[locale]}</dd>
        </div>
        <div className="card p-5">
          <dt className="text-[12.5px] font-semibold text-ink-3">{t("leaderboard.avg")} · {t("leaderboard.reviews")}</dt>
          <dd className="tnum mt-1 text-[24px] font-extrabold tracking-[-0.02em]">
            {card.reviewCount ? Math.round(card.avgScore) : "–"} <span className="text-[14px] font-semibold text-ink-3">/ {card.reviewCount}</span>
          </dd>
          {rankIdx >= 0 && <dd className="mt-0.5 text-[12px] text-ink-3">{t("profile.rankedAt", { n: rankIdx + 1 })}</dd>}
        </div>
        <div className="card p-5">
          <dt className="text-[12.5px] font-semibold text-ink-3">{t("dash.verification")}</dt>
          <dd className="mt-2">
            <span className={`tag ${vTone}`}>{t(vKey)}</span>
          </dd>
        </div>
      </dl>

      {profile.verification !== "verified" && (
        <section className={`mt-6 rounded-[16px] p-6 ${profile.verification === "rejected" ? "bg-[#fdecec]" : "bg-brand-tint"}`}>
          {profile.verification === "pending" ? (
            <>
              <h2 className="text-[17px] font-bold text-brand-deep">{t("dash.pendingTitle")}</h2>
              <p className="mt-1.5 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-2">{t("dash.pendingBody")}</p>
            </>
          ) : profile.verification === "rejected" ? (
            <>
              <h2 className="text-[17px] font-bold text-danger">{t("dash.rejectedTitle")}</h2>
              <p className="mt-1.5 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-2">{t("dash.rejectedBody")}</p>
              {profile.verificationNote && <p className="mt-3 rounded-[10px] bg-paper px-4 py-3 text-[14px] text-ink">“{profile.verificationNote}”</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/specialist/profile" className="btn btn-sm btn-outline">{t("dash.editProfile")}</Link>
                {isProfileComplete(profile) && (
                  <form action={resubmitForReview}>
                    <button type="submit" className="btn btn-sm btn-primary">{t("dash.resubmit")}</button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[17px] font-bold text-brand-deep">{t("dash.incompleteTitle")}</h2>
              <p className="mt-1.5 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-2">{t("dash.incompleteBody")}</p>
              <Link href="/specialist/onboarding" className="btn btn-sm btn-primary mt-4">{t("dash.completeProfile")}</Link>
            </>
          )}
        </section>
      )}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("dash.links")}>
        <Link href="/specialist/profile" className="btn btn-sm btn-secondary">{t("dash.editProfile")}</Link>
        <Link href="/specialist/availability" className="btn btn-sm btn-secondary">{t("dash.availability")}</Link>
        <Link href="/specialist/earnings" className="btn btn-sm btn-secondary">{t("dash.earnings")}</Link>
        {profile.verification === "verified" && (
          <Link href="/specialist/posts/new" className="btn btn-sm btn-secondary">{t("dash.newPost")}</Link>
        )}
      </nav>

      <section className="mt-10">
        <h2 className="h3">{t("dash.upcoming")}</h2>
        {upcoming.length === 0 ? (
          <p className="panel mt-3 p-8 text-center text-[14.5px] text-ink-2">{t("dash.emptyUpcoming")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map(({ b, seeker, affiliation }) => (
              <li key={b.id} className="card flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusTag status={b.status} t={t} />
                    <span className="tnum text-[13px] font-semibold text-ink-2">{fmtRelativeDay(b.startAt, now, locale)}</span>
                  </div>
                  <div className="mt-2 text-[17px] font-bold">
                    {seeker} <span className="muted text-[13px] font-medium">{affiliation ?? t("dash.seeker")}</span>
                  </div>
                  <div className="tnum mt-1 text-[14px] text-ink-2">
                    {fmtDateTime(b.startAt, locale)} · {categoryLabel(b.category, locale)} · {t("common.creditsN", { n: b.price })}
                  </div>
                  {b.seekerNote && <p className="muted mt-2 text-[14px]">“{b.seekerNote}”</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link href={`/sessions/${b.id}`} className="btn btn-sm btn-primary">
                    {t("dash.enter")} <IconArrow size={16} />
                  </Link>
                  {b.status === "confirmed" && (
                    <form action={cancelBooking}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <input type="hidden" name="back" value="/specialist/dashboard" />
                      <button type="submit" className="text-[13px] font-semibold text-ink-3 hover:text-danger">{t("dash.cancel")}</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {flagged.length > 0 && (
        <section className="mt-10">
          <h2 className="h3">
            {t("dash.flagged")} <span className="tnum text-ink-3">{new Set(flagged.map((x) => x.r.id)).size}</span>
          </h2>
          <p className="muted mt-1 text-[13.5px]">{t("dash.flaggedHint")}</p>
          <ul className="mt-3 space-y-2">
            {flagged.map(({ r, f }) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[#fbf3e3] px-4 py-3 text-[14px]">
                <span className="tnum font-bold">{r.score}/100</span>
                <span className="tag tag-warn">{FRAUD_RULE_LABELS[f.rule as FraudRule]?.[locale] ?? f.rule}</span>
                <span className="muted truncate">{r.body}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="h3">{t("dash.recent")}</h2>
        {recent.length === 0 ? (
          <p className="panel mt-3 p-8 text-center text-[14.5px] text-ink-2">{t("common.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {recent.map(({ b, seeker }) => {
              const r = reviewByBooking.get(b.id);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusTag status={b.status} t={t} />
                      <span className="text-[15px] font-bold">{seeker}</span>
                    </div>
                    <div className="tnum mt-0.5 text-[13.5px] text-ink-2">
                      {fmtDateTime(b.startAt, locale)} · {categoryLabel(b.category, locale)} · {t("common.creditsN", { n: b.price })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r && (
                      <span className="tnum text-[14px] font-bold">
                        {r.score}
                        <span className="text-ink-3">/100</span>
                        {r.status === "flagged" && <span className="tag tag-warn ml-2">{t("profile.flagged")}</span>}
                      </span>
                    )}
                    <Link href={`/sessions/${b.id}`} className="btn btn-sm btn-outline">{t("session.transcript")}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
