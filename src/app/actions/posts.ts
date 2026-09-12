"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { requireSpecialist } from "@/lib/auth";

export async function createPost(formData: FormData) {
  const { user, profile } = await requireSpecialist();
  if (profile.verification !== "verified") redirect("/specialist/dashboard?error=not_verified");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  if (title.length < 2 || body.length < 10) redirect("/specialist/posts/new?error=invalid");
  const id = crypto.randomUUID();
  db.insert(schema.posts).values({ id, authorId: user.id, title, body, createdAt: new Date() }).run();
  revalidatePath("/", "layout");
  redirect(`/posts/${id}?published=1`);
}
