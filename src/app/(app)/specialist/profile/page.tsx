import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { CATEGORIES } from "@/lib/categories";
import { updateProfile } from "@/app/actions/specialist";
import { FormError } from "@/components/FormError";
import { Notice } from "@/components/Notice";

export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const [{ user, profile }, { t, locale }] = await Promise.all([requireSpecialist(), getT()]);
  const edu = [...profile.education, ...Array(4)].slice(0, 4);
  const exp = [...profile.experience, ...Array(4)].slice(0, 4);
  const label = "mb-1.5 block text-[13px] font-semibold text-ink-3";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{t("sp.profile.title")}</h1>
      <div className="mt-6">
        {sp.welcome && <Notice tone="info">{t("signup.welcome")}</Notice>}
        {sp.saved && <Notice>{t("sp.profile.saved")}</Notice>}
        <FormError code={sp.error} />
      </div>
      <form action={updateProfile} className="space-y-8">
        <section className="card space-y-5 p-6">
          <div>
            <label htmlFor="headline" className={label}>{t("sp.profile.headline")}</label>
            <input id="headline" name="headline" defaultValue={profile.headline} required maxLength={80} className="field" />
          </div>
          <div>
            <label htmlFor="bio" className={label}>{t("sp.profile.bio")}</label>
            <textarea id="bio" name="bio" defaultValue={profile.bio} required minLength={10} maxLength={1200} className="textarea" />
          </div>
          <fieldset>
            <legend className={label}>{t("sp.profile.categories")}</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label key={c.id} className="cursor-pointer">
                  <input type="checkbox" name="categories" value={c.id} defaultChecked={profile.categories.includes(c.id)} className="peer sr-only" />
                  <span className="block rounded-[10px] bg-mist px-3.5 py-2 text-[14px] font-semibold transition-colors duration-150 peer-checked:bg-brand-tint peer-checked:text-brand-deep peer-checked:ring-1 peer-checked:ring-brand/40 peer-checked:ring-inset peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                    {c[locale]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="basePrice" className={label}>{t("sp.profile.basePrice")}</label>
            <input id="basePrice" name="basePrice" type="number" min={10} max={1000} step={5} defaultValue={profile.basePrice} required className="field tnum max-w-[200px]" />
            <p className="mt-1.5 text-[12.5px] text-ink-3">{t("sp.profile.basePriceHint")}</p>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="h3">{t("sp.profile.education")}</h2>
          <div className="mt-4 space-y-3">
            {edu.map((e, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1.2fr_0.8fr_1fr]">
                <input name={`edu_school_${i}`} defaultValue={e?.school ?? ""} placeholder={t("sp.profile.school")} className="field h-10" aria-label={`${t("sp.profile.school")} ${i + 1}`} />
                <input name={`edu_major_${i}`} defaultValue={e?.major ?? ""} placeholder={t("sp.profile.major")} className="field h-10" aria-label={`${t("sp.profile.major")} ${i + 1}`} />
                <input name={`edu_degree_${i}`} defaultValue={e?.degree ?? ""} placeholder={t("sp.profile.degree")} className="field h-10" aria-label={`${t("sp.profile.degree")} ${i + 1}`} />
                <input name={`edu_years_${i}`} defaultValue={e?.years ?? ""} placeholder={t("sp.profile.years")} className="field tnum h-10" aria-label={`${t("sp.profile.years")} ${i + 1}`} />
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="h3">{t("sp.profile.experience")}</h2>
          <div className="mt-4 space-y-3">
            {exp.map((e, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1.4fr_1fr]">
                <input name={`exp_company_${i}`} defaultValue={e?.company ?? ""} placeholder={t("sp.profile.company")} className="field h-10" aria-label={`${t("sp.profile.company")} ${i + 1}`} />
                <input name={`exp_title_${i}`} defaultValue={e?.title ?? ""} placeholder={t("sp.profile.jobTitle")} className="field h-10" aria-label={`${t("sp.profile.jobTitle")} ${i + 1}`} />
                <input name={`exp_years_${i}`} defaultValue={e?.years ?? ""} placeholder={t("sp.profile.years")} className="field tnum h-10" aria-label={`${t("sp.profile.years")} ${i + 1}`} />
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="h3">{t("sp.profile.resume")}</h2>
          <p className="mt-1 text-[13px] text-ink-3">{t("sp.profile.resumeHint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" name="resume" accept="application/pdf" className="text-[14px] file:mr-3 file:rounded-[10px] file:border-0 file:bg-mist file:px-3.5 file:py-2 file:text-[13.5px] file:font-semibold file:text-ink hover:file:bg-brand-tint" />
            {profile.resumePath && (
              <a href={`/api/files/resume/${user.id}`} target="_blank" rel="noreferrer" className="text-[13.5px] font-semibold text-brand underline">
                {t("sp.profile.resumeCurrent")}
              </a>
            )}
          </div>
        </section>

        <button type="submit" className="btn btn-primary">{t("sp.profile.save")}</button>
      </form>
    </div>
  );
}
