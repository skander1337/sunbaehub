"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSpecialist } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { postTx } from "@/lib/services/ledger";
import { submitForReview } from "@/lib/services/admin";
import { clampBaseRate } from "@/lib/rules/pricing";
import type { Education, Experience } from "@/db/schema";

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function updateProfile(formData: FormData) {
  const { user, profile: current } = await requireSpecialist();
  const intent = String(formData.get("intent") ?? "save") === "submit" ? "submit" : "save";
  const back = intent === "submit" ? "/specialist/onboarding" : "/specialist/profile";
  const headline = str(formData, "headline", 80);
  const bio = str(formData, "bio", 1200);
  const requestedRate = clampBaseRate(Number(formData.get("requestedRate")));
  const categories = CATEGORIES.map((c) => c.id).filter((id) => formData.getAll("categories").includes(id));
  if (headline.length < 2 || bio.length < 10 || categories.length === 0) {
    redirect(`${back}?error=invalid`);
  }
  const education: Education[] = [];
  const experience: Experience[] = [];
  for (let i = 0; i < 4; i++) {
    const school = str(formData, `edu_school_${i}`);
    if (school) education.push({ school, major: str(formData, `edu_major_${i}`), degree: str(formData, `edu_degree_${i}`), years: str(formData, `edu_years_${i}`, 40) });
    const company = str(formData, `exp_company_${i}`);
    if (company) experience.push({ company, title: str(formData, `exp_title_${i}`), years: str(formData, `exp_years_${i}`, 40) });
  }
  if (education.length === 0) redirect(`${back}?error=education_required`);
  if (experience.length === 0) redirect(`${back}?error=experience_required`);

  const patch: Partial<typeof schema.specialistProfiles.$inferInsert> = { headline, bio, requestedRate, categories, education, experience };
  const file = formData.get("resume");
  if (!current.resumePath && !(file instanceof File && file.size > 0)) redirect(`${back}?error=resume_required`);
  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf" || file.size > 8 * 1024 * 1024) redirect(`${back}?error=file`);
    const dir = path.join(process.cwd(), "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${user.id}.pdf`), Buffer.from(await file.arrayBuffer()));
    patch.resumePath = `uploads/${user.id}.pdf`;
  }
  const now = new Date();
  const submitted = db.transaction((tx) => {
    tx.update(schema.specialistProfiles).set(patch).where(eq(schema.specialistProfiles.userId, user.id)).run();
    if (intent === "submit" || current.verification === "rejected") return submitForReview(tx, user.id, now);
    return false;
  });
  revalidatePath("/", "layout");
  if (intent === "submit") redirect(submitted ? "/specialist/dashboard?submitted=1" : `${back}?error=not_complete`);
  redirect(`/specialist/profile?saved=1${submitted ? "&submitted=1" : ""}`);
}

export async function resubmitForReview() {
  const { user } = await requireSpecialist();
  const ok = db.transaction((tx) => submitForReview(tx, user.id, new Date()));
  revalidatePath("/", "layout");
  redirect(ok ? "/specialist/dashboard?submitted=1" : "/specialist/onboarding?error=not_complete");
}

export async function saveAvailability(formData: FormData) {
  const { user } = await requireSpecialist();
  const rules: { dayOfWeek: number; startMinute: number; endMinute: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let w = 0; w < 2; w++) {
      const s = formData.get(`d${d}_w${w}_start`);
      const e = formData.get(`d${d}_w${w}_end`);
      if (s === null || e === null || s === "" || e === "") continue;
      const sh = Number(s);
      const eh = Number(e);
      if (Number.isInteger(sh) && Number.isInteger(eh) && sh >= 0 && eh <= 24 && eh > sh) rules.push({ dayOfWeek: d, startMinute: sh * 60, endMinute: eh * 60 });
    }
  }
  db.transaction((tx) => {
    tx.delete(schema.availabilityRules).where(eq(schema.availabilityRules.specialistId, user.id)).run();
    for (const r of rules) tx.insert(schema.availabilityRules).values({ specialistId: user.id, ...r }).run();
  });
  revalidatePath("/", "layout");
  redirect("/specialist/availability?saved=1");
}

export async function requestWithdrawal(formData: FormData) {
  const { user } = await requireSpecialist();
  const amount = Math.round(Number(formData.get("amount")));
  const bankInfo = str(formData, "bankInfo", 80);
  if (!Number.isFinite(amount) || amount < 100 || amount > user.creditBalance) redirect("/specialist/earnings?error=amount");
  if (bankInfo.length < 4) redirect("/specialist/earnings?error=bank");
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(schema.withdrawalRequests).values({ userId: user.id, amount, bankInfo, status: "pending", createdAt: now }).run();
    postTx(tx, { userId: user.id, type: "withdrawal", amount: -amount, note: `출금 신청 (${bankInfo.split(" ")[0]})`, createdAt: now });
  });
  revalidatePath("/", "layout");
  redirect("/specialist/earnings?requested=1");
}
