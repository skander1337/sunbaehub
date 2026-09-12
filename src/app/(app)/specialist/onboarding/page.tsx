import { redirect } from "next/navigation";
import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { FormError } from "@/components/FormError";
import { ProfileForm } from "@/components/ProfileForm";
import { IconCheck } from "@/components/icons";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [{ user, profile }, { t }] = await Promise.all([requireSpecialist(), getT()]);
  if (profile.verification === "verified" || profile.verification === "pending") redirect("/specialist/dashboard");
  const steps = [t("onboarding.step1"), t("onboarding.step2"), t("onboarding.step3")];
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{t("onboarding.title")}</h1>
      <ol className="mt-5 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
        {steps.map((s, i) => {
          const state = i === 0 ? "done" : i === 1 ? "current" : "todo";
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                  state === "done" ? "bg-success text-white" : state === "current" ? "bg-brand text-white" : "bg-mist text-ink-3"
                }`}
              >
                {state === "done" ? <IconCheck size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={state === "todo" ? "text-ink-3" : "text-ink"}>{s}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <p className="muted mt-4 max-w-[60ch] text-[15px] leading-relaxed">{t("onboarding.intro")}</p>
      <div className="mt-6">
        <FormError code={error} />
      </div>
      <ProfileForm profile={profile} userId={user.id} mode="onboarding" />
    </div>
  );
}
