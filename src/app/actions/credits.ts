"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { postTx } from "@/lib/services/ledger";

const PACKS = new Set([100, 300, 1000]);
const METHODS: Record<string, string> = { kakao: "카카오페이", toss: "토스페이", card: "신용카드" };

export async function topUp(formData: FormData) {
  const user = await requireUser();
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "kakao");
  if (!PACKS.has(amount)) redirect("/me/credits?error=invalid");
  db.transaction((tx) => postTx(tx, { userId: user.id, type: "topup", amount, note: `크레딧 충전 (${METHODS[method] ?? METHODS.kakao})`, createdAt: new Date() }));
  revalidatePath("/", "layout");
  redirect(`/me/credits?topped=${amount}`);
}
