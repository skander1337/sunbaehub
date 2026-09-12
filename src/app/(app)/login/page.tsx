import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { login } from "@/app/actions/auth";
import { FormError } from "@/components/FormError";
import { DEMO_CREDENTIALS, SHOW_DEMO_CREDENTIALS } from "@/lib/demo";
import type { DictKey } from "@/lib/i18n/dictionary";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { t } = await getT();
  const label = "mb-1.5 block text-[13px] font-semibold text-ink-3";
  return (
    <div className="mx-auto max-w-md">
      <h1 className="h1">{t("login.title")}</h1>
      <p className="muted mt-2 text-[15px]">{t("login.subtitle")}</p>
      <form action={login} className="card mt-6 space-y-5 p-6">
        {next && <input type="hidden" name="next" value={next} />}
        <FormError code={error} />
        <div>
          <label htmlFor="email" className={label}>{t("login.email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="jiwoo@korea.ac.kr" className="field" />
        </div>
        <div>
          <label htmlFor="password" className={label}>{t("login.password")}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className="field" />
        </div>
        <button type="submit" className="btn btn-primary w-full">{t("login.submit")}</button>
        <p className="text-center text-[13.5px] text-ink-2">
          {t("login.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-brand underline">{t("login.signup")}</Link>
        </p>
      </form>
      {SHOW_DEMO_CREDENTIALS && (
        <div className="mt-4 rounded-[12px] border border-dashed border-line px-4 py-3">
          <div className="text-[12px] font-semibold text-ink-3">{t("login.demoTitle")}</div>
          <ul className="tnum mt-1.5 space-y-1 text-[13px] text-ink-2">
            {DEMO_CREDENTIALS.map((c) => (
              <li key={c.email} className="flex flex-wrap gap-x-2">
                <span className="w-12 font-semibold text-ink">{t(`login.demo${c.role === "seeker" ? "Seeker" : c.role === "expert" ? "Expert" : "Admin"}` as DictKey)}</span>
                <span>{c.email}</span>
                <span className="text-ink-3">/</span>
                <span>{c.password}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
