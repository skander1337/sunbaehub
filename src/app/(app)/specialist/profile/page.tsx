import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { FormError } from "@/components/FormError";
import { Notice } from "@/components/Notice";
import { ProfileForm } from "@/components/ProfileForm";

export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const [{ user, profile }, { t }] = await Promise.all([requireSpecialist(), getT()]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{t("sp.profile.title")}</h1>
      <div className="mt-6">
        {sp.saved && <Notice>{t("sp.profile.saved")}</Notice>}
        {profile.verification !== "verified" && <Notice tone="info">{t("dash.notListed")}</Notice>}
        <FormError code={sp.error} />
      </div>
      <ProfileForm profile={profile} userId={user.id} mode="edit" />
    </div>
  );
}
