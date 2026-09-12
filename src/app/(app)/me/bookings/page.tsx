import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { categoryLabel } from "@/lib/categories";
import { fmtDateTime, fmtRelativeDay } from "@/lib/seoul";
import { cancellationOutcome } from "@/lib/rules/refund";
import { cancelBooking, openDispute } from "@/app/actions/booking";
import { FormError } from "@/components/FormError";
import { Notice } from "@/components/Notice";
import { StatusTag } from "@/components/StatusTag";
import { IconArrow } from "@/components/icons";

type SP = { booked?: string; reviewed?: string; disputed?: string; cancelled?: string; error?: string };

export default async function MyBookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [user, { t, locale }] = await Promise.all([requireUser("/me/bookings"), getT()]);
  const now = new Date();
  const rows = db
    .select({ b: schema.bookings, specialist: schema.users.name, headline: schema.specialistProfiles.headline })
    .from(schema.bookings)
    .innerJoin(schema.users, eq(schema.users.id, schema.bookings.specialistId))
    .leftJoin(schema.specialistProfiles, eq(schema.specialistProfiles.userId, schema.bookings.specialistId))
    .where(eq(schema.bookings.seekerId, user.id))
    .orderBy(desc(schema.bookings.startAt))
    .all();
  const reviews = new Map(db.select().from(schema.reviews).where(eq(schema.reviews.reviewerId, user.id)).all().map((r) => [r.bookingId, r]));
  const upcoming = rows.filter((r) => r.b.status === "confirmed" || r.b.status === "in_progress").sort((a, b) => a.b.startAt.getTime() - b.b.startAt.getTime());
  const past = rows.filter((r) => !(r.b.status === "confirmed" || r.b.status === "in_progress"));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h1">{t("bookings.title")}</h1>
      <p className="muted mt-2 text-[15px]">{t("bookings.sub")}</p>
      <div className="mt-6">
        {sp.booked && <Notice>{t("bookings.bookedOk")}</Notice>}
        {sp.reviewed && <Notice>{t("bookings.reviewedOk")}</Notice>}
        {sp.disputed && <Notice tone="info">{t("bookings.disputedOk")}</Notice>}
        {sp.cancelled && <Notice tone="info">{t("bookings.cancelledOk")}</Notice>}
        <FormError code={sp.error} />
      </div>

      <section className="mt-2">
        <h2 className="h3">{t("bookings.upcoming")}</h2>
        {upcoming.length === 0 ? (
          <p className="panel mt-3 p-8 text-center text-[14.5px] text-ink-2">
            {t("bookings.emptyUpcoming")}{" "}
            <Link href="/specialists" className="font-semibold text-brand underline">
              {t("nav.specialists")}
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map(({ b, specialist, headline }) => {
              const outcome = cancellationOutcome(b.startAt, now, "seeker");
              return (
                <li key={b.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusTag status={b.status} t={t} />
                        <span className="tnum text-[13px] font-semibold text-ink-2">{fmtRelativeDay(b.startAt, now, locale)}</span>
                      </div>
                      <div className="mt-2 text-[17px] font-bold">
                        <Link href={`/specialists/${b.specialistId}`} className="hover:text-brand-deep">
                          {specialist}
                        </Link>
                        <span className="muted ml-2 text-[14px] font-medium">{headline}</span>
                      </div>
                      <div className="tnum mt-1 text-[14px] text-ink-2">
                        {fmtDateTime(b.startAt, locale)} · {t("profile.minN", { n: b.durationMin })} · {categoryLabel(b.category, locale)} · {t("common.creditsN", { n: b.price })}
                      </div>
                      {b.seekerNote && <p className="muted mt-2 text-[14px]">“{b.seekerNote}”</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Link href={`/sessions/${b.id}`} className="btn btn-sm btn-primary">
                        {t("bookings.enter")}
                        <IconArrow size={16} />
                      </Link>
                      {b.status === "confirmed" && (
                        <details className="text-right">
                          <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-3 hover:text-ink">{t("bookings.cancel")}</summary>
                          <form action={cancelBooking} className="mt-2 max-w-[260px] text-left">
                            <input type="hidden" name="bookingId" value={b.id} />
                            <input type="hidden" name="back" value="/me/bookings?cancelled=1" />
                            <p className="text-[13px] text-ink-2">{outcome === "full_refund" ? t("bookings.cancelFull") : t("bookings.cancelSplit")}</p>
                            <button type="submit" className="btn btn-sm btn-danger mt-2">
                              {t("bookings.cancel")}
                            </button>
                          </form>
                        </details>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="h3">{t("bookings.past")}</h2>
        {past.length === 0 ? (
          <p className="panel mt-3 p-8 text-center text-[14.5px] text-ink-2">{t("bookings.emptyPast")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {past.map(({ b, specialist }) => {
              const review = reviews.get(b.id);
              const canReview = (b.status === "completed" || b.status === "refunded") && !review;
              const canDispute = b.status === "completed" && !b.settledAt && !review;
              return (
                <li key={b.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusTag status={b.status} t={t} />
                        {review && <span className="tnum text-[13px] font-semibold text-ink-2">{t("bookings.reviewed", { n: review.score })}</span>}
                      </div>
                      <div className="mt-1.5 text-[16px] font-bold">
                        <Link href={`/specialists/${b.specialistId}`} className="hover:text-brand-deep">
                          {specialist}
                        </Link>
                      </div>
                      <div className="tnum mt-0.5 text-[13.5px] text-ink-2">
                        {fmtDateTime(b.startAt, locale)} · {t("profile.minN", { n: b.durationMin })} · {categoryLabel(b.category, locale)} · {t("common.creditsN", { n: b.price })}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {canReview && (
                        <Link href={`/bookings/${b.id}/review`} className="btn btn-sm btn-primary">
                          {t("bookings.review")}
                        </Link>
                      )}
                      {b.status !== "cancelled" && (
                        <Link href={`/sessions/${b.id}`} className="btn btn-sm btn-outline">
                          {t("bookings.certificate")}
                        </Link>
                      )}
                    </div>
                  </div>
                  {canDispute && (
                    <details className="mt-3">
                      <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-3 hover:text-ink">{t("bookings.dispute")}</summary>
                      <form action={openDispute} className="panel mt-2 max-w-[520px] p-4">
                        <input type="hidden" name="bookingId" value={b.id} />
                        <p className="text-[13px] text-ink-2">{t("bookings.disputeHint")}</p>
                        <label htmlFor={`reason-${b.id}`} className="mt-3 block text-[13px] font-semibold text-ink-3">
                          {t("bookings.disputeReason")}
                        </label>
                        <textarea id={`reason-${b.id}`} name="reason" required minLength={5} className="textarea mt-1.5 min-h-20 bg-paper" />
                        <button type="submit" className="btn btn-sm btn-primary mt-3">
                          {t("bookings.disputeSubmit")}
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
