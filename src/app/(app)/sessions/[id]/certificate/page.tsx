import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { categoryLabel } from "@/lib/categories";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/seoul";
import { isParticipant } from "@/lib/rules/session";
import { BRAND } from "@/lib/brand";
import { PrintButton } from "@/components/PrintButton";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { t, locale }] = await Promise.all([requireUser(`/sessions/${id}/certificate`), getT()]);
  const b = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!b || !isParticipant(b, user.id) || b.status === "cancelled" || b.status === "confirmed" || b.status === "in_progress") notFound();
  const seeker = db.select().from(schema.users).where(eq(schema.users.id, b.seekerId)).get()!;
  const specialist = db.select().from(schema.users).where(eq(schema.users.id, b.specialistId)).get()!;
  const profile = db.select().from(schema.specialistProfiles).where(eq(schema.specialistProfiles.userId, b.specialistId)).get();
  const review = db.select().from(schema.reviews).where(eq(schema.reviews.bookingId, id)).get();
  const messageCount = Number(db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(eq(schema.messages.bookingId, id)).get()?.n ?? 0);
  const minutes = Math.max(1, Math.round(((b.completedAt ?? b.endAt).getTime() - b.startAt.getTime()) / 60_000));
  const code = b.id.replace(/-/g, "").slice(0, 10).toUpperCase();
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-3">
      <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
      <dd className="text-[15px] font-medium">{v}</dd>
    </div>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="h1">{t("cert.title")}</h1>
        <PrintButton label={t("cert.print")} />
      </div>
      <article className="card p-8 print:border-0 print:p-0 sm:p-10">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] font-extrabold tracking-[-0.03em]">{BRAND.nameKo}</span>
            <span className="text-[13px] font-semibold text-ink-3">{BRAND.name}</span>
          </div>
          <span className="tnum text-[12.5px] text-ink-3">
            {t("cert.issued")} {fmtDate(new Date(), locale)}
          </span>
        </div>
        <h2 className="mt-8 text-[28px] font-extrabold tracking-[-0.02em]">{t("cert.title")}</h2>
        <p className="muted mt-2 text-[14.5px]">{t("cert.sub")}</p>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {row(t("cert.seeker"), seeker.name)}
          {row(
            t("cert.specialist"),
            <>
              {specialist.name}
              {profile && <span className="muted block text-[13px] font-normal">{profile.headline} · {profile.education.map((e) => [e.school, e.major].filter(Boolean).join(" ")).join(", ")}</span>}
            </>,
          )}
          {row(t("cert.topic"), categoryLabel(b.category, locale))}
          {row(t("cert.when"), <span className="tnum">{fmtDateTime(b.startAt, locale)} – {fmtTime(b.completedAt ?? b.endAt)}</span>)}
          {row(t("cert.duration"), <span className="tnum">{t("cert.minutes", { n: minutes })} · {t("cert.messages", { n: messageCount })}</span>)}
          {row(t("cert.score"), review ? <span className="tnum">{review.score}/100</span> : <span className="muted">{t("cert.noScore")}</span>)}
          {row(t("cert.code"), <span className="tnum font-mono tracking-wider">{code}</span>)}
        </dl>
        <p className="mt-8 text-[12px] text-ink-3">{t("cert.footer")}</p>
      </article>
    </div>
  );
}
