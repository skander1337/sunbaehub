import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { fmtDateTime } from "@/lib/seoul";
import { FRAUD_RULE_LABELS, type FraudRule } from "@/lib/rules/fraud";
import { resolveFlag } from "@/app/actions/admin";

export default async function FlagsPage() {
  const { t, locale } = await getT();
  const reviewer = alias(schema.users, "reviewer");
  const specialist = alias(schema.users, "specialist");
  const rows = db
    .select({ f: schema.reviewFlags, r: schema.reviews, reviewer: reviewer.name, specialist: specialist.name })
    .from(schema.reviewFlags)
    .innerJoin(schema.reviews, eq(schema.reviews.id, schema.reviewFlags.reviewId))
    .innerJoin(reviewer, eq(reviewer.id, schema.reviews.reviewerId))
    .innerJoin(specialist, eq(specialist.id, schema.reviews.specialistId))
    .orderBy(desc(schema.reviewFlags.createdAt))
    .all();
  const open = rows.filter((x) => x.f.status === "open");
  const done = rows.filter((x) => x.f.status !== "open");
  const detailText = (d: Record<string, unknown>) =>
    Object.entries(d)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" · ");

  return (
    <div>
      {open.length === 0 ? (
        <p className="panel p-8 text-center text-[14.5px] text-ink-2">{t("admin.emptyQueue")}</p>
      ) : (
        <ul className="space-y-3">
          {open.map(({ f, r, reviewer: rv, specialist: sp }) => (
            <li key={f.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-warn">{FRAUD_RULE_LABELS[f.rule as FraudRule]?.[locale] ?? f.rule}</span>
                <span className="tnum text-[13px] text-ink-3">{fmtDateTime(r.createdAt, locale)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px]">
                <span>
                  <span className="text-ink-3">{t("admin.reviewer")}</span> <span className="font-semibold">{rv}</span>
                </span>
                <span>→</span>
                <span>
                  <span className="text-ink-3">{t("admin.specialist")}</span> <span className="font-semibold">{sp}</span>
                </span>
                <span className="tnum font-extrabold">{r.score}/100</span>
              </div>
              <p className="mt-2 text-[14.5px] text-ink-2">“{r.body}”</p>
              <p className="tnum mt-2 text-[12.5px] text-ink-3">
                {t("admin.flagDetail")}: {detailText(f.detail)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={resolveFlag}>
                  <input type="hidden" name="flagId" value={f.id} />
                  <input type="hidden" name="decision" value="dismissed" />
                  <button type="submit" className="btn btn-sm btn-outline">{t("admin.dismiss")}</button>
                </form>
                <form action={resolveFlag}>
                  <input type="hidden" name="flagId" value={f.id} />
                  <input type="hidden" name="decision" value="confirmed" />
                  <button type="submit" className="btn btn-sm btn-danger">{t("admin.confirm")}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-[14px] font-semibold text-ink-2">
            {t("admin.resolved")} <span className="tnum text-ink-3">{done.length}</span>
          </summary>
          <ul className="mt-3 divide-y divide-line border-y border-line text-[13.5px]">
            {done.map(({ f, r, reviewer: rv, specialist: sp }) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={`tag ${f.status === "confirmed" ? "tag-danger" : "tag-neutral"}`}>{f.status}</span>
                <span className="tag tag-neutral">{FRAUD_RULE_LABELS[f.rule as FraudRule]?.[locale] ?? f.rule}</span>
                <span>
                  {rv} → {sp} · <span className="tnum font-semibold">{r.score}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
