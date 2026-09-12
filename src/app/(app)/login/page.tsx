import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { login } from "@/app/actions/auth";
import { FormError } from "@/components/FormError";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORDS } from "@/lib/demo";

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
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" className="field" />
        </div>
        <div>
          <label htmlFor="password" className={label}>{t("login.password")}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="field" />
        </div>
        <button type="submit" className="btn btn-primary w-full">{t("login.submit")}</button>
        <p className="text-center text-[13.5px] text-ink-2">
          {t("login.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-brand underline">{t("login.signup")}</Link>
        </p>
      </form>
      <section aria-labelledby="judge-admin-title" className="mt-8 border-t border-line pt-6">
        <h2 id="judge-admin-title" className="text-[18px] font-bold">{t("login.judgeAdminTitle")}</h2>
        <dl className="mt-4 space-y-3 rounded-[12px] bg-mist p-4 text-[14px]">
          <div>
            <dt className="text-[13px] font-semibold text-ink-2">{t("login.email")}</dt>
            <dd className="mt-1 select-all break-all font-semibold">{DEMO_ADMIN_EMAIL}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-ink-2">{t("login.password")}</dt>
            <dd className="mt-1 select-all font-semibold">{DEMO_PASSWORDS.admin}</dd>
          </div>
        </dl>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-ink-2">
          <li>{t("login.judgeAdminStep1")}</li>
          <li>{t("login.judgeAdminStep2")}</li>
          <li>{t("login.judgeAdminStep3")}</li>
        </ol>
        <form action={login} className="mt-5">
          <input type="hidden" name="email" value={DEMO_ADMIN_EMAIL} />
          <input type="hidden" name="password" value={DEMO_PASSWORDS.admin} />
          <input type="hidden" name="next" value="/admin/verifications" />
          <button type="submit" className="btn btn-outline w-full">{t("login.judgeAdminSignIn")}</button>
        </form>
      </section>
    </div>
  );
}
