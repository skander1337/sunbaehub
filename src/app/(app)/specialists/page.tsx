import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { listSpecialists } from "@/lib/queries/specialists";
import { CATEGORIES } from "@/lib/categories";
import { SpecialistCard } from "@/components/SpecialistCard";

export default async function SpecialistsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const { t, locale } = await getT();
  const active = CATEGORIES.some((c) => c.id === category) ? category : undefined;
  const list = listSpecialists({ category: active });

  const chip = (isActive: boolean) =>
    `inline-flex h-10 items-center rounded-[12px] px-4 text-[14.5px] font-semibold transition-colors duration-200 ${
      isActive ? "bg-ink text-white" : "bg-mist text-ink hover:bg-brand-tint hover:text-brand-deep"
    }`;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="h1">{t("specialists.title")}</h1>
          <p className="muted mt-2 max-w-[60ch] text-[15px]">{t("specialists.sub")}</p>
        </div>
        <p className="tnum text-[14px] font-semibold text-ink-2">{t("specialists.countN", { n: list.length })}</p>
      </div>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Category filter">
        <Link href="/specialists" className={chip(!active)}>
          {t("specialists.all")}
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={`/specialists?category=${c.id}`} className={chip(active === c.id)}>
            {c[locale]}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p className="panel mt-8 p-10 text-center text-[15px] text-ink-2">{t("specialists.empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <li key={s.id} className="h-full">
              <SpecialistCard s={s} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
