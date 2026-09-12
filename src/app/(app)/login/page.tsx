import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { login } from "@/app/actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t, locale } = await getT();
  const users = db.select().from(schema.users).where(eq(schema.users.isPlatform, false)).all();
  const profiles = db.select().from(schema.specialistProfiles).all();
  const headline = new Map(profiles.map((p) => [p.userId, p.headline]));

  const groups = [
    { title: t("login.seekers"), users: users.filter((u) => !u.isSpecialist && !u.isAdmin) },
    { title: t("login.specialists"), users: users.filter((u) => u.isSpecialist) },
    { title: t("login.admins"), users: users.filter((u) => u.isAdmin) },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h1">{t("login.title")}</h1>
      <p className="muted mt-2 text-[15px]">{t("login.subtitle")}</p>
      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{g.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {g.users.map((u) => (
                <li key={u.id}>
                  <form action={login}>
                    <input type="hidden" name="userId" value={u.id} />
                    {next && <input type="hidden" name="next" value={next} />}
                    <button
                      type="submit"
                      className="card flex w-full items-center gap-4 p-4 text-left transition-colors duration-200 hover:border-brand hover:bg-brand-tint/40"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[15px] font-bold text-brand">
                        {u.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{u.name}</span>
                        <span className="muted block truncate text-[13px]">
                          {headline.get(u.id) ?? (u.isAdmin ? (locale === "ko" ? "운영팀" : "Operations") : u.email)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[13px] font-semibold text-ink-2">{t("common.creditsN", { n: u.creditBalance.toLocaleString() })}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
