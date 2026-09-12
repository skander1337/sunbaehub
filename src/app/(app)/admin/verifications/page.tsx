import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { categoryLabel } from "@/lib/categories";
import { fmtDateTime } from "@/lib/seoul";
import { reviewVerification } from "@/app/actions/admin";
import { MIN_BASE_RATE, MAX_BASE_RATE } from "@/lib/rules/pricing";

export default async function VerificationsPage() {
  const { t, locale } = await getT();
  const rows = db
    .select({ p: schema.specialistProfiles, u: schema.users })
    .from(schema.specialistProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.specialistProfiles.userId))
    .where(eq(schema.specialistProfiles.verification, "pending"))
    .all();
  return (
    <div>
      {rows.length === 0 ? (
        <p className="panel p-8 text-center text-[14.5px] text-ink-2">{t("admin.emptyQueue")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ p, u }) => (
            <li key={u.id} className="card p-5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[17px] font-bold">{u.name}</span>
                <span className="muted text-[14px]">{p.headline}</span>
                {p.submittedAt && <span className="tnum text-[12.5px] text-ink-3">· {t("admin.submittedAt")} {fmtDateTime(p.submittedAt, locale)}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.categories.map((c) => (
                  <span key={c} className="tag tag-neutral">{categoryLabel(c, locale)}</span>
                ))}
              </div>
              <div className="mt-3 grid gap-3 text-[14px] sm:grid-cols-2">
                <div>
                  <div className="text-[12.5px] font-semibold text-ink-3">{t("profile.education")}</div>
                  {p.education.map((e, i) => (
                    <div key={i} className="tnum">{[e.school, e.major, e.degree, e.years].filter(Boolean).join(" · ")}</div>
                  ))}
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold text-ink-3">{t("profile.experience")}</div>
                  {p.experience.map((e, i) => (
                    <div key={i} className="tnum">{[e.company, e.title, e.years].filter(Boolean).join(" · ")}</div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.resumePath && (
                  <a href={`/api/files/resume/${u.id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                    {t("admin.resume")} (PDF)
                  </a>
                )}
                <form action={reviewVerification} className="flex w-full flex-col gap-2 sm:max-w-xl">
                  <input type="hidden" name="userId" value={u.id} />
                  <label htmlFor={`rate-${u.id}`} className="text-[12.5px] font-semibold text-ink-3">
                    {t("admin.baseRate")} <span className="tnum font-medium text-ink-3">· {t("admin.requested")} {p.requestedRate ?? "–"}</span>
                  </label>
                  <input id={`rate-${u.id}`} name="baseRate" type="number" min={MIN_BASE_RATE} max={MAX_BASE_RATE} step={5} defaultValue={p.requestedRate ?? 100} className="field tnum h-10 max-w-[200px]" />
                  <p className="text-[12px] text-ink-3">{t("admin.rateHint", { n: MIN_BASE_RATE })}</p>
                  <label htmlFor={`note-${u.id}`} className="text-[12.5px] font-semibold text-ink-3">{t("admin.rejectNote")}</label>
                  <input id={`note-${u.id}`} name="note" maxLength={500} placeholder={t("admin.noteHint")} className="field h-10" />
                  <div className="flex gap-2">
                    <button type="submit" name="decision" value="verified" className="btn btn-sm btn-primary">{t("admin.approve")}</button>
                    <button type="submit" name="decision" value="rejected" className="btn btn-sm btn-danger">{t("admin.reject")}</button>
                  </div>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
