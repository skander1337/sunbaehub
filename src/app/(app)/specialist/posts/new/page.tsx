import { redirect } from "next/navigation";
import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createPost } from "@/app/actions/posts";
import { FormError } from "@/components/FormError";

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [{ profile }, { t }] = await Promise.all([requireSpecialist(), getT()]);
  if (profile.verification !== "verified") redirect("/specialist/dashboard?error=not_verified");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{t("posts.new")}</h1>
      <p className="muted mt-2 text-[15px]">{t("posts.sub")}</p>
      <form action={createPost} className="card mt-6 space-y-5 p-6">
        <FormError code={error} />
        <div>
          <label htmlFor="title" className="mb-2 block text-[13px] font-semibold text-ink-3">{t("posts.form.title")}</label>
          <input id="title" name="title" required minLength={2} maxLength={120} className="field" />
        </div>
        <div>
          <label htmlFor="body" className="mb-2 block text-[13px] font-semibold text-ink-3">{t("posts.form.body")}</label>
          <textarea id="body" name="body" required minLength={10} maxLength={5000} className="textarea min-h-64" />
        </div>
        <button type="submit" className="btn btn-primary">{t("posts.form.submit")}</button>
      </form>
    </div>
  );
}
