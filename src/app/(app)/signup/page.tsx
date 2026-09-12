import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { signup } from "@/app/actions/auth";
import { CATEGORIES } from "@/lib/categories";
import { FormError } from "@/components/FormError";
import { RoleFields } from "@/components/RoleFields";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string }> }) {
  const { role, error } = await searchParams;
  const { t, locale } = await getT();
  const initialRole = role === "expert" ? "expert" : "seeker";
  const label = "mb-1.5 block text-[13px] font-semibold text-ink-3";
  return (
    <div className="mx-auto max-w-md">
      <h1 className="h1">{t("signup.title")}</h1>
      <p className="muted mt-2 text-[15px]">{t("signup.subtitle")}</p>
      <form action={signup} className="card mt-6 space-y-5 p-6">
        <FormError code={error} />
        <div>
          <label htmlFor="name" className={label}>{t("signup.name")}</label>
          <input id="name" name="name" required maxLength={40} autoComplete="name" className="field" />
        </div>
        <div>
          <label htmlFor="email" className={label}>{t("login.email")}</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        </div>
        <div>
          <label htmlFor="password" className={label}>{t("login.password")}</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
        </div>
        <RoleFields
          initialRole={initialRole}
          labels={{
            role: t("signup.role"),
            seeker: t("signup.roleSeeker"),
            expert: t("signup.roleExpert"),
            headline: t("signup.headline"),
            headlinePh: t("signup.headlinePh"),
            categories: t("signup.categories"),
            basePrice: t("signup.basePrice"),
          }}
          categories={CATEGORIES.map((c) => ({ id: c.id, label: c[locale] }))}
        />
        <button type="submit" className="btn btn-primary w-full">{t("signup.submit")}</button>
        <p className="text-center text-[13.5px] text-ink-2">
          {t("signup.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand underline">{t("signup.login")}</Link>
        </p>
      </form>
    </div>
  );
}
