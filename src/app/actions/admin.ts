"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireSpecialist } from "@/lib/auth";
import { resolveFlag as resolveFlagSvc, runFraudScan } from "@/lib/services/review";
import { resolveDispute as resolveDisputeSvc } from "@/lib/services/dispute";
import { settleDueBookings } from "@/lib/services/settlement";
import { requestVerification as requestVerificationSvc, reviewVerification as reviewVerificationSvc, resolveWithdrawal as resolveWithdrawalSvc } from "@/lib/services/admin";

export async function runScan() {
  await requireAdmin();
  const r = db.transaction((tx) => runFraudScan(tx));
  revalidatePath("/", "layout");
  redirect(`/admin?scanned=${r.evaluated}&flagged=${r.flagged}`);
}

export async function settleNow() {
  await requireAdmin();
  const n = db.transaction((tx) => settleDueBookings(tx, new Date()));
  revalidatePath("/", "layout");
  redirect(`/admin?settled=${n}`);
}

export async function resolveFlag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("flagId") ?? "");
  const decision = String(formData.get("decision")) === "confirmed" ? "confirmed" : "dismissed";
  db.transaction((tx) => resolveFlagSvc(tx, id, decision, new Date()));
  revalidatePath("/", "layout");
  redirect("/admin/flags");
}

export async function resolveDispute(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("disputeId") ?? "");
  const decision = String(formData.get("decision")) === "approved" ? "approved" : "rejected";
  const note = String(formData.get("note") ?? "");
  db.transaction((tx) => resolveDisputeSvc(tx, id, decision, note, new Date()));
  revalidatePath("/", "layout");
  redirect("/admin/disputes");
}

export async function reviewVerification(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const decision = String(formData.get("decision")) === "verified" ? "verified" : "rejected";
  db.transaction((tx) => reviewVerificationSvc(tx, userId, decision, new Date()));
  revalidatePath("/", "layout");
  redirect("/admin/verifications");
}

export async function resolveWithdrawal(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("withdrawalId") ?? "");
  const decision = String(formData.get("decision")) === "paid" ? "paid" : "rejected";
  db.transaction((tx) => resolveWithdrawalSvc(tx, id, decision, new Date()));
  revalidatePath("/", "layout");
  redirect("/admin/withdrawals");
}

export async function requestVerification() {
  const { user } = await requireSpecialist();
  db.transaction((tx) => requestVerificationSvc(tx, user.id, new Date()));
  revalidatePath("/", "layout");
  redirect("/specialist/dashboard?requested=1");
}
