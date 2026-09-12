import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { BRAND } from "@/lib/brand";
import { LocaleToggle } from "./LocaleToggle";
import { MobileMenu } from "./MobileMenu";
import { IconBell } from "./icons";
import { logout } from "@/app/actions/auth";

export async function Nav({ tone = "paper" }: { tone?: "paper" | "brand" }) {
  const [{ t }, user] = await Promise.all([getT(), currentUser()]);
  const onBrand = tone === "brand";
  const unread = user
    ? Number(
        db
          .select({ n: sql<number>`count(*)` })
          .from(schema.notifications)
          .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
          .get()?.n ?? 0,
      )
    : 0;

  const link = `text-[14px] font-medium transition-colors duration-200 ${onBrand ? "text-white/80 hover:text-white" : "text-ink-2 hover:text-ink"}`;

  return (
    <header className={`relative ${onBrand ? "text-white" : "border-b border-line bg-paper"}`}>
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-baseline gap-1.5" aria-label={BRAND.full}>
            <span className={`text-[20px] font-extrabold tracking-[-0.03em] ${onBrand ? "text-white" : "text-ink"}`}>{BRAND.nameKo}</span>
            <span className={`text-[13px] font-semibold tracking-[-0.01em] ${onBrand ? "text-white/70" : "text-ink-3"}`}>{BRAND.name}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            <Link href="/specialists" className={link}>{t("nav.specialists")}</Link>
            <Link href="/leaderboard" className={link}>{t("nav.leaderboard")}</Link>
            <Link href="/posts" className={link}>{t("nav.posts")}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          <LocaleToggle tone={tone} />
          {user ? (
            <>
              <Link
                href="/me/credits"
                className={`tnum hidden h-9 items-center rounded-[10px] px-2.5 text-[13px] font-semibold sm:inline-flex ${onBrand ? "text-white/90 hover:bg-white/10" : "text-ink hover:bg-mist"}`}
              >
                {t("common.creditsN", { n: user.creditBalance.toLocaleString() })}
              </Link>
              <Link
                href="/me/notifications"
                aria-label={t("nav.notifications")}
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${onBrand ? "text-white/90 hover:bg-white/10" : "text-ink-2 hover:bg-mist"}`}
              >
                <IconBell size={19} />
                {unread > 0 && (
                  <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${onBrand ? "bg-white" : "bg-brand"}`} aria-label={`${unread}`} />
                )}
              </Link>
              <details className="relative">
                <summary
                  className={`flex h-9 cursor-pointer list-none items-center gap-2 rounded-[10px] px-2.5 text-[14px] font-semibold select-none ${onBrand ? "text-white hover:bg-white/10" : "text-ink hover:bg-mist"}`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${onBrand ? "bg-white text-brand" : "bg-brand-tint text-brand"}`}>
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="hidden sm:inline">{user.name}</span>
                </summary>
                <div className="card absolute right-0 z-20 mt-2 w-52 p-1.5 text-ink shadow-raise">
                  <MenuLink href="/me/bookings">{t("nav.bookings")}</MenuLink>
                  <MenuLink href="/me/credits">{t("nav.credits")}</MenuLink>
                  {user.isSpecialist && <MenuLink href="/specialist/dashboard">{t("nav.dashboard")}</MenuLink>}
                  {user.isAdmin && <MenuLink href="/admin">{t("nav.admin")}</MenuLink>}
                  <div className="hairline my-1.5" />
                  <form action={logout}>
                    <button type="submit" className="block w-full rounded-[10px] px-3 py-2 text-left text-[14px] text-ink-2 hover:bg-mist">
                      {t("nav.logout")}
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link href="/login" className={`btn btn-sm hidden sm:inline-flex ${onBrand ? "btn-on-brand" : "btn-primary"}`}>
              {t("nav.login")}
            </Link>
          )}
          <MobileMenu
            tone={tone}
            loggedIn={!!user}
            primary={[
              { href: "/specialists", label: t("nav.specialists") },
              { href: "/leaderboard", label: t("nav.leaderboard") },
              { href: "/posts", label: t("nav.posts") },
            ]}
            account={[
              { href: "/me/bookings", label: t("nav.bookings") },
              { href: "/me/credits", label: t("nav.credits") },
              { href: "/me/notifications", label: t("nav.notifications") },
              ...(user?.isSpecialist ? [{ href: "/specialist/dashboard", label: t("nav.dashboard") }] : []),
              ...(user?.isAdmin ? [{ href: "/admin", label: t("nav.admin") }] : []),
            ]}
            labels={{ menu: t("nav.menu"), login: t("nav.login"), signup: t("nav.signup"), logout: t("nav.logout") }}
          />
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-[10px] px-3 py-2 text-[14px] font-medium text-ink hover:bg-mist">
      {children}
    </Link>
  );
}
