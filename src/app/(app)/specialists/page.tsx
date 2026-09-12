import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { listAvailableSpecialists } from "@/lib/queries/specialists";
import { CATEGORIES } from "@/lib/categories";
import { SpecialistCard } from "@/components/SpecialistCard";

type SearchParams = { category?: string; duration?: string; today?: string; affordable?: string; sort?: string };

export default async function SpecialistsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { category, duration, today, affordable, sort: requestedSort } = await searchParams;
  const [{ t, locale }, user] = await Promise.all([getT(), currentUser()]);
  const active = CATEGORIES.some((c) => c.id === category) ? category : undefined;
  const durationMin = duration === "60" ? 60 : 30;
  const availableToday = today === "1";
  const affordableOnly = affordable === "1";
  const sort = requestedSort === "soonest" ? "soonest" : "recommended";
  const query = new URLSearchParams({ duration: String(durationMin), sort });
  if (active) query.set("category", active);
  if (availableToday) query.set("today", "1");
  if (affordableOnly) query.set("affordable", "1");
  const creditQuery = new URLSearchParams(query);
  creditQuery.set("affordable", "1");
  const loginHref = `/login?next=${encodeURIComponent(`/specialists?${creditQuery}`)}`;
  if (affordableOnly && !user) redirect(loginHref);
  const list = listAvailableSpecialists({
    category: active,
    durationMin,
    availableToday,
    affordableOnly,
    balance: user?.creditBalance ?? null,
    userId: user?.id,
    sort,
    now: new Date(),
  });
  const categoryHref = (value?: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set("category", value);
    else next.delete("category");
    return `/specialists?${next}`;
  };

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
      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("specialists.categoryFilter")}>
        <Link href={categoryHref()} className={chip(!active)} aria-current={!active ? "true" : undefined}>
          {t("specialists.all")}
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={categoryHref(c.id)} className={chip(active === c.id)} aria-current={active === c.id ? "true" : undefined}>
            {c[locale]}
          </Link>
        ))}
      </nav>
      <form key={query.toString()} action="/specialists" method="get" className="mt-5 border-y border-line py-4" aria-label={t("specialists.searchFilters")}>
        {active && <input type="hidden" name="category" value={active} />}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="min-w-[120px] flex-1 sm:flex-none">
            <label htmlFor="directory-duration" className="mb-1.5 block text-[13px] font-semibold text-ink-2">{t("profile.duration")}</label>
            <select id="directory-duration" name="duration" defaultValue={durationMin} className="field h-10">
              <option value="30">{t("profile.min30")}</option>
              <option value="60">{t("profile.min60")}</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1 sm:flex-none">
            <label htmlFor="directory-sort" className="mb-1.5 block text-[13px] font-semibold text-ink-2">{t("specialists.sortLabel")}</label>
            <select id="directory-sort" name="sort" defaultValue={sort} className="field h-10">
              <option value="recommended">{t("specialists.sortRecommended")}</option>
              <option value="soonest">{t("specialists.sortSoonest")}</option>
            </select>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-3 py-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-medium">
              <input type="checkbox" name="today" value="1" defaultChecked={availableToday} className="h-4 w-4 accent-brand" />
              {t("specialists.availableToday")}
            </label>
            <label className={`inline-flex items-center gap-2 text-[14px] font-medium ${user ? "cursor-pointer" : "text-ink-3"}`}>
              <input type="checkbox" name="affordable" value="1" defaultChecked={affordableOnly} disabled={!user} aria-describedby={!user ? "directory-credit-login" : undefined} className="h-4 w-4 accent-brand" />
              {t("specialists.withinBalance")}
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-sm btn-primary">{t("specialists.applyFilters")}</button>
            <Link href="/specialists" className="text-[13px] font-semibold text-ink-2 underline underline-offset-4">{t("specialists.resetFilters")}</Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-relaxed text-ink-2">
          <p>{t("specialists.availabilityHint", { n: durationMin })}</p>
          {user ? (
            <p className="tnum">{t("specialists.balanceHint", { n: user.creditBalance })}</p>
          ) : (
            <Link id="directory-credit-login" href={loginHref} className="font-medium text-brand underline underline-offset-4">{t("specialists.loginForBalance")}</Link>
          )}
        </div>
      </form>
      {list.length === 0 ? (
        <div className="panel mt-8 p-8 text-center">
          <p className="text-[15px] font-semibold">{t("specialists.emptyFiltered")}</p>
          <p className="mt-2 text-[14px] text-ink-2">{t("specialists.emptyFilteredHint")}</p>
          <Link href="/specialists" className="btn btn-sm btn-outline mt-4">{t("specialists.resetFilters")}</Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <li key={s.id} className="h-full">
              <SpecialistCard s={s} locale={locale} t={t} appointment={{ durationMin, price: s.selectedPrice, nextAvailableAt: s.nextAvailableAt }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
