import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { priceFor, priceForDuration, MIN_BASE_RATE, MAX_BASE_RATE } from "@/lib/rules/pricing";
import { setBaseRate } from "@/app/actions/admin";
import { Notice } from "@/components/Notice";
import type { DictKey } from "@/lib/i18n/dictionary";

export default async function AdminSpecialistsPage({ searchParams }: { searchParams: Promise<{ saved?: string; rate?: string }> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const rows = db
    .select({ p: schema.specialistProfiles, u: schema.users })
    .from(schema.specialistProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.specialistProfiles.userId))
    .orderBy(desc(schema.specialistProfiles.verification), desc(schema.specialistProfiles.rankScore))
    .all();
  const savedName = sp.saved ? rows.find((r) => r.u.id === sp.saved)?.u.name : null;
  const vTone: Record<string, string> = { verified: "tag-brand", pending: "tag-warn", rejected: "tag-danger", none: "tag-neutral" };
  return (
    <div>
      {savedName && sp.rate && <Notice>{t("admin.rateSaved", { name: savedName, n: sp.rate })}</Notice>}
      <p className="tnum mb-4 rounded-[12px] bg-mist px-4 py-3 text-[13px] text-ink-2">{t("admin.formula", { n: MIN_BASE_RATE })}</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
              <th className="py-3 pl-5">{t("admin.specialist")}</th>
              <th className="py-3">{t("dash.verification")}</th>
              <th className="py-3 text-right">{t("leaderboard.avg")} · {t("leaderboard.reviews")}</th>
              <th className="py-3 text-right">{t("admin.requested")}</th>
              <th className="py-3">{t("admin.baseRate")}</th>
              <th className="py-3 pr-5 text-right">{t("admin.currentPrice")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ p, u }) => {
              const pricing = priceFor(p.basePrice, p.reviewCount, p.avgScore);
              return (
                <tr key={u.id}>
                  <td className="py-3 pl-5">
                    <Link href={`/specialists/${u.id}`} className="font-bold hover:text-brand-deep">{u.name}</Link>
                    <div className="muted max-w-[220px] truncate text-[12.5px]">{p.headline}</div>
                  </td>
                  <td className="py-3">
                    <span className={`tag ${vTone[p.verification] ?? "tag-neutral"}`}>{t(`dash.v.${p.verification}` as DictKey)}</span>
                  </td>
                  <td className="tnum py-3 text-right">
                    {p.reviewCount ? Math.round(p.avgScore) : "–"} <span className="text-ink-3">· {p.reviewCount}</span>
                  </td>
                  <td className="tnum py-3 text-right text-ink-2">{p.requestedRate ?? "–"}</td>
                  <td className="py-3">
                    <form action={setBaseRate} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <input name="baseRate" type="number" min={MIN_BASE_RATE} max={MAX_BASE_RATE} step={5} defaultValue={p.basePrice} className="field tnum h-9 w-[110px] px-2" aria-label={`${u.name} ${t("admin.baseRate")}`} />
                      <button type="submit" className="btn btn-sm btn-outline">{t("admin.saveRate")}</button>
                    </form>
                  </td>
                  <td className="tnum py-3 pr-5 text-right">
                    <span className="font-bold">{pricing.price}</span>
                    <span className="text-ink-3"> · ×{pricing.multiplier.toFixed(2)}</span>
                    <div className="text-[12px] text-ink-3">30분 {priceForDuration(pricing.price, 30)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
