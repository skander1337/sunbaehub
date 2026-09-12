import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { categoryLabel } from "@/lib/categories";
import { fmtDateTime, fmtTime } from "@/lib/seoul";
import { canChat, isParticipant, sessionWindow } from "@/lib/rules/session";
import { touchSession } from "@/lib/services/booking";
import { devShiftBooking, endSession } from "@/app/actions/booking";
import { SessionRoom, type ChatMessage } from "@/components/session/SessionRoom";
import { StatusTag } from "@/components/StatusTag";
import { FormError } from "@/components/FormError";

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [user, { t, locale }] = await Promise.all([requireUser(`/sessions/${(await params).id}`), getT()]);
  const now = new Date();
  let booking = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!booking || !isParticipant(booking, user.id)) notFound();
  booking = db.transaction((tx) => touchSession(tx, booking!, now));

  const otherId = booking.seekerId === user.id ? booking.specialistId : booking.seekerId;
  const other = db.select().from(schema.users).where(eq(schema.users.id, otherId)).get()!;
  const messages = db.select().from(schema.messages).where(eq(schema.messages.bookingId, id)).orderBy(asc(schema.messages.createdAt)).all();
  const review = db.select().from(schema.reviews).where(eq(schema.reviews.bookingId, id)).get();
  const live = booking.status === "confirmed" || booking.status === "in_progress";
  const phase: "early" | "open" | "closed" = live ? sessionWindow(booking, now) : "closed";
  const isSeeker = booking.seekerId === user.id;
  const dev = process.env.NODE_ENV !== "production";

  const serialized: ChatMessage[] = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    kind: m.kind,
    body: m.body,
    lang: m.lang,
    translatedBody: m.translatedBody,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">{t("session.title")}</h1>
            <StatusTag status={booking.status} t={t} />
          </div>
          <p className="muted mt-1 text-[14.5px]">
            {t("session.partner")}: <Link href={isSeeker ? `/specialists/${otherId}` : "#"} className="font-semibold text-ink hover:text-brand-deep">{other.name}</Link> · {categoryLabel(booking.category, locale)} ·{" "}
            <span className="tnum">{fmtDateTime(booking.startAt, locale)}–{fmtTime(booking.endAt)}</span> · {t("common.creditsN", { n: booking.price })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "open" && (
            <form action={endSession}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <button type="submit" className="btn btn-sm btn-danger" title={t("session.endConfirm")}>
                {t("session.end")}
              </button>
            </form>
          )}
          {!live && isSeeker && !review && (booking.status === "completed" || booking.status === "refunded") && (
            <Link href={`/bookings/${booking.id}/review`} className="btn btn-sm btn-primary">
              {t("session.leaveReview")}
            </Link>
          )}
          {!live && booking.status !== "cancelled" && (
            <Link href={`/sessions/${booking.id}/certificate`} className="btn btn-sm btn-outline">
              {t("session.certificate")}
            </Link>
          )}
        </div>
      </div>
      <div className="mt-5">
        <FormError code={error} />
      </div>
      {booking.seekerNote && !isSeeker && <p className="panel mb-4 px-4 py-3 text-[14px] text-ink-2">“{booking.seekerNote}”</p>}

      <SessionRoom
        bookingId={booking.id}
        meId={user.id}
        otherName={other.name}
        otherInitial={other.name.slice(0, 1)}
        initialMessages={serialized}
        canSend={canChat(booking, user.id, now)}
        phase={phase}
        startAt={booking.startAt.toISOString()}
        endAt={booking.endAt.toISOString()}
      />

      {dev && live && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-line px-4 py-3">
          <span className="text-[12.5px] text-ink-3">{t("session.devHint")}</span>
          <form action={devShiftBooking} className="inline">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="mode" value="start_now" />
            <button type="submit" className="btn btn-sm btn-outline">{t("session.devStart")}</button>
          </form>
          <form action={devShiftBooking} className="inline">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="mode" value="end_now" />
            <button type="submit" className="btn btn-sm btn-outline">{t("session.devEnd")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
