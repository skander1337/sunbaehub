import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { fmtDateTime } from "@/lib/seoul";
import { BRAND } from "@/lib/brand";
import { resolveWithdrawal } from "@/app/actions/admin";

export default async function WithdrawalsPage() {
  const { t, locale } = await getT();
  const rows = db
    .select({ w: schema.withdrawalRequests, name: schema.users.name })
    .from(schema.withdrawalRequests)
    .innerJoin(schema.users, eq(schema.users.id, schema.withdrawalRequests.userId))
    .orderBy(desc(schema.withdrawalRequests.createdAt))
    .all();
  const open = rows.filter((x) => x.w.status === "pending");
  const done = rows.filter((x) => x.w.status !== "pending");
  return (
    <div>
      {open.length === 0 ? (
        <p className="panel p-8 text-center text-[14.5px] text-ink-2">{t("admin.emptyQueue")}</p>
      ) : (
        <ul className="space-y-3">
          {open.map(({ w, name }) => (
            <li key={w.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="text-[16px] font-bold">
                  {name} · <span className="tnum">{t("common.creditsN", { n: w.amount.toLocaleString() })}</span>
                  <span className="tnum muted ml-2 text-[13px] font-medium">≈ ₩{(w.amount * BRAND.creditsToWon).toLocaleString()}</span>
                </div>
                <div className="tnum mt-1 text-[13.5px] text-ink-2">
                  {w.bankInfo} · {fmtDateTime(w.createdAt, locale)}
                </div>
              </div>
              <form action={resolveWithdrawal} className="flex gap-2">
                <input type="hidden" name="withdrawalId" value={w.id} />
                <button type="submit" name="decision" value="paid" className="btn btn-sm btn-primary">{t("admin.paid")}</button>
                <button type="submit" name="decision" value="rejected" className="btn btn-sm btn-outline">{t("admin.reject")}</button>
              </form>
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
            {done.map(({ w, name }) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={`tag ${w.status === "paid" ? "tag-success" : "tag-neutral"}`}>{w.status}</span>
                <span>
                  {name} · <span className="tnum">{t("common.creditsN", { n: w.amount.toLocaleString() })}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
