"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BookingRuleError, SlotUnavailable, cancelBooking as cancelBookingSvc, createBooking as createBookingSvc, devShiftBooking as devShiftSvc, endSession as endSessionSvc } from "@/lib/services/booking";
import { InsufficientCredits } from "@/lib/services/ledger";
import { ReviewRuleError, submitReview as submitReviewSvc } from "@/lib/services/review";
import { DisputeRuleError, openDispute as openDisputeSvc } from "@/lib/services/dispute";
import { publish } from "@/lib/realtime";
import { AttachmentError, persistAttachmentFile, recordAttachment } from "@/lib/services/attachments";

function fail(path: string, code: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(code)}`);
}

export async function createBooking(formData: FormData) {
  const user = await requireUser();
  const specialistId = String(formData.get("specialistId") ?? "");
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const category = String(formData.get("category") ?? "");
  const note = String(formData.get("note") ?? "");
  const durationMin = Number(formData.get("durationMin") ?? 60);
  const back = `/specialists/${specialistId}`;
  if (!specialistId || Number.isNaN(startAt.getTime()) || !category || !(durationMin === 30 || durationMin === 60)) fail(back, "invalid");
  const attachment = formData.get("attachment");
  const hasFile = attachment instanceof File && attachment.size > 0;
  if (hasFile) {
    try {
      const { validateAttachment } = await import("@/lib/services/attachments");
      validateAttachment(attachment);
    } catch (e) {
      if (e instanceof AttachmentError) fail(back, e.code === "file_size" ? "file_size" : "file_type");
      throw e;
    }
  }
  let id = "";
  try {
    id = db.transaction((tx) => createBookingSvc(tx, { seekerId: user.id, specialistId, startAt, category, note, durationMin }, new Date())).id;
  } catch (e) {
    if (e instanceof SlotUnavailable) fail(back, "slot");
    if (e instanceof InsufficientCredits) fail(back, "credits");
    if (e instanceof BookingRuleError) fail(back, e.code);
    throw e;
  }
  if (hasFile) {
    const { storedPath, size } = await persistAttachmentFile(id, attachment);
    const now = new Date();
    db.transaction((tx) => recordAttachment(tx, { bookingId: id, uploaderId: user.id, fileName: attachment.name, mime: attachment.type, size, storedPath }, now));
  }
  revalidatePath("/", "layout");
  redirect(`/me/bookings?booked=${id}`);
}

export async function cancelBooking(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "");
  const back = formData.get("back") === "/specialist/dashboard" ? "/specialist/dashboard" : "/me/bookings";
  const submittedRefund = formData.get("expectedRefund");
  const expectedRefund = typeof submittedRefund === "string" && /^\d+$/.test(submittedRefund) ? Number(submittedRefund) : Number.NaN;
  try {
    db.transaction((tx) => cancelBookingSvc(tx, bookingId, user.id, new Date(), expectedRefund));
  } catch (e) {
    if (e instanceof BookingRuleError && e.code === "refund_quote_changed") redirect(`${back}?refundChanged=${encodeURIComponent(bookingId)}`);
    if (e instanceof BookingRuleError) fail(back, e.code);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`${back}?cancelled=1`);
}

export async function endSession(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    db.transaction((tx) => endSessionSvc(tx, bookingId, user.id, new Date()));
  } catch (e) {
    if (e instanceof BookingRuleError) fail(`/sessions/${bookingId}`, e.code);
    throw e;
  }
  publish(bookingId, "status", { status: "completed" });
  revalidatePath("/", "layout");
  redirect(`/sessions/${bookingId}`);
}

export async function submitReview(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "");
  const score = Number(formData.get("score"));
  const body = String(formData.get("body") ?? "");
  try {
    db.transaction((tx) => submitReviewSvc(tx, { bookingId, reviewerId: user.id, score, body }, new Date()));
  } catch (e) {
    if (e instanceof ReviewRuleError) fail(`/bookings/${bookingId}/review`, e.code);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/me/bookings?reviewed=${bookingId}`);
}

export async function openDispute(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (reason.trim().length < 5) fail("/me/bookings", "reason");
  try {
    db.transaction((tx) => openDisputeSvc(tx, { bookingId, seekerId: user.id, reason }, new Date()));
  } catch (e) {
    if (e instanceof DisputeRuleError) fail("/me/bookings", e.code);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/me/bookings?disputed=${bookingId}`);
}

export async function devShiftBooking(formData: FormData) {
  if (process.env.NODE_ENV === "production") redirect("/");
  await requireUser();
  const bookingId = String(formData.get("bookingId") ?? "");
  const mode = String(formData.get("mode") ?? "") === "end_now" ? "end_now" : "start_now";
  db.transaction((tx) => devShiftSvc(tx, bookingId, mode, new Date()));
  publish(bookingId, "status", { status: mode });
  revalidatePath("/", "layout");
  redirect(`/sessions/${bookingId}`);
}
