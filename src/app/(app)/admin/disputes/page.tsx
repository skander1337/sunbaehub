import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { fmtDateTime } from "@/lib/seoul";
import { categoryLabel } from "@/lib/categories";
import { refundSplit } from "@/lib/rules/refund";
import { resolveDispute } from "@/app/actions/admin";

export default async function DisputesPage() {
  const { t, locale } = await getT();
  const seeker = alias(schema.users, "seeker");
  const specialist = alias(schema.users, "specialist");
  const rows = db
    .select({ d: schema.disputes, b: schema.bookings, seeker: seeker.name, specialist: specialist.name })
    .from(schema.disputes)
    .innerJoin(schema.bookings, eq(schema.bookings.id, schema.disputes.bookingId))
    .innerJoin(seeker, eq(seeker.id, schema.bookings.seekerId))
    .innerJoin(specialist, eq(specialist.id, schema.bookings.specialistId))
    .orderBy(desc(schema.disputes.createdAt))
    .all();
  const open = rows.filter((x) => x.d.status === "open");
  const done = rows.filter((x) => x.d.status !== "open");

  return (
    <div>
      {open.length === 0 ? (
        <p className="panel p-8 text-center text-[14.5px] text-ink-2">{t("admin.emptyQueue")}</p>
      ) : (
        <ul className="space-y-3">
          {open.map(({ d, b, seeker: sk, specialist: sp }) => {
            const split = refundSplit(b.price);
            return (
              <li key={d.id} className="card p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px]">
                  <span>
                    <span className="text-ink-3">{t("dash.seeker")}</span> <span className="font-semibold">{sk}</span>
                  </span>
                  <span>→</span>
                  <span>
                    <span className="text-ink-3">{t("admin.specialist")}</span> <span className="font-semibold">{sp}</span>
                  </span>
                  <span className="tnum text-ink-2">
                    {fmtDateTime(b.startAt, locale)} · {categoryLabel(b.category, locale)} · {t("common.creditsN", { n: b.price })}
                  </span>
                </div>
                <p className="mt-3 text-[14.5px]">
                  <span className="text-ink-3">{t("admin.reason")}:</span> “{d.reason}”
                </p>
                <p className="tnum mt-2 text-[13px] text-ink-2">{t("admin.split", { a: split.seekerRefund, b: split.specialistPayout, c: split.platformFee })}</p>
                <p className="text-[13px] text-ink-3">{t("admin.rejectHint")}</p>
                <form action={resolveDispute} className="mt-4">
                  <input type="hidden" name="disputeId" value={d.id} />
                  <label className="block text-[12.5px] font-semibold text-ink-3" htmlFor={`note-${d.id}`}>
                    {t("admin.note")}
                  </label>
                  <input id={`note-${d.id}`} name="note" className="field mt-1.5 h-10 max-w-md" />
                  <div className="mt-3 flex gap-2">
                    <button type="submit" name="decision" value="approved" className="btn btn-sm btn-primary">{t("admin.approve")}</button>
                    <button type="submit" name="decision" value="rejected" className="btn btn-sm btn-outline">{t("admin.reject")}</button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-[14px] font-semibold text-ink-2">
            {t("admin.resolved")} <span className="tnum text-ink-3">{done.length}</span>
          </summary>
          <ul className="mt-3 divide-y divide-line border-y border-line text-[13.5px]">
            {done.map(({ d, b, seeker: sk, specialist: sp }) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={`tag ${d.status === "approved" ? "tag-danger" : "tag-neutral"}`}>{d.status}</span>
                <span>
                  {sk} → {sp} · <span className="tnum">{t("common.creditsN", { n: b.price })}</span>
                </span>
                {d.adminNote && <span className="muted">· {d.adminNote}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
