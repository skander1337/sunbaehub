import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { categoryLabel } from "@/lib/categories";
import { fmtDateTime } from "@/lib/seoul";
import { submitReview } from "@/app/actions/booking";
import { ScoreInput } from "@/components/ScoreInput";
import { FormError } from "@/components/FormError";

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [user, { t, locale }] = await Promise.all([requireUser(`/bookings/${id}/review`), getT()]);
  const booking = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!booking || booking.seekerId !== user.id) notFound();
  const existing = db.select().from(schema.reviews).where(eq(schema.reviews.bookingId, id)).get();
  if (existing) redirect("/me/bookings?error=already_reviewed");
  if (!(booking.status === "completed" || booking.status === "refunded")) redirect("/me/bookings?error=not_completed");
  const specialist = db.select().from(schema.users).where(eq(schema.users.id, booking.specialistId)).get()!;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="h1">{t("review.title")}</h1>
      <p className="muted mt-2 text-[15px]">{t("review.sub", { name: specialist.name })}</p>
      <p className="tnum mt-1 text-[13.5px] text-ink-3">
        {fmtDateTime(booking.startAt, locale)} · {categoryLabel(booking.category, locale)} · {t("common.creditsN", { n: booking.price })}
      </p>
      <form action={submitReview} className="card mt-6 space-y-6 p-6">
        <input type="hidden" name="bookingId" value={booking.id} />
        <FormError code={error} />
        <div>
          <div className="mb-3 text-[13px] font-semibold text-ink-3">{t("review.score")}</div>
          <ScoreInput name="score" />
        </div>
        <div>
          <label htmlFor="body" className="mb-2 block text-[13px] font-semibold text-ink-3">
            {t("review.body")}
          </label>
          <textarea id="body" name="body" required minLength={5} maxLength={1000} className="textarea" placeholder={t("review.bodyPh")} />
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-3">{t("review.settle")}</p>
        <button type="submit" className="btn btn-primary w-full">
          {t("review.submit")}
        </button>
      </form>
    </div>
  );
}
