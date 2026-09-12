import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { listSpecialists } from "@/lib/queries/specialists";
import { SpecialistCard } from "@/components/SpecialistCard";
import { categoryLabel } from "@/lib/categories";
import { IconCheck } from "@/components/icons";

export default async function LeaderboardPage() {
  const { t, locale } = await getT();
  const all = listSpecialists();
  const ranked = all.filter((s) => s.ranked);
  const fresh = all.filter((s) => !s.ranked);

  return (
    <div>
      <h1 className="h1">{t("leaderboard.title")}</h1>
      <p className="muted mt-2 max-w-[60ch] text-[15px]">{t("leaderboard.sub")}</p>

      <div className="card mt-8 overflow-hidden">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
              <th className="w-12 py-3 pl-5">{t("leaderboard.rank")}</th>
              <th className="py-3">{t("leaderboard.name")}</th>
              <th className="hidden py-3 text-right sm:table-cell">{t("leaderboard.avg")}</th>
              <th className="hidden py-3 text-right sm:table-cell">{t("leaderboard.reviews")}</th>
              <th className="py-3 text-right">{t("leaderboard.score")}</th>
              <th className="py-3 pr-5 text-right">{t("leaderboard.price")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ranked.map((s, i) => (
              <tr key={s.id} className="transition-colors duration-150 hover:bg-mist/60">
                <td className="tnum py-4 pl-5 text-[16px] font-extrabold text-ink-3">{i + 1}</td>
                <td className="py-4">
                  <Link href={`/specialists/${s.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[14px] font-bold text-brand">{s.name.slice(0, 1)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-bold">
                        {s.name}
                        {s.verification === "verified" && <IconCheck size={14} strokeWidth={2.5} className="text-brand" />}
                      </span>
                      <span className="muted block truncate text-[13px]">{s.categories.map((c) => categoryLabel(c, locale)).join(" · ")}</span>
                    </span>
                  </Link>
                </td>
                <td className="tnum hidden py-4 text-right font-semibold sm:table-cell">{Math.round(s.avgScore)}</td>
                <td className="tnum hidden py-4 text-right text-ink-2 sm:table-cell">{s.reviewCount}</td>
                <td className="tnum py-4 text-right font-bold">{s.rankScore.toFixed(1)}</td>
                <td className="tnum py-4 pr-5 text-right font-semibold">{t("common.creditsN", { n: s.pricing.price })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fresh.length > 0 && (
        <section className="mt-12">
          <h2 className="h2">{t("leaderboard.new")}</h2>
          <p className="muted mt-1.5 text-[14px]">{t("leaderboard.newSub")}</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((s) => (
              <li key={s.id} className="h-full">
                <SpecialistCard s={s} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
