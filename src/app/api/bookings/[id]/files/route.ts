import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { isParticipant } from "@/lib/rules/session";
import { AttachmentError, persistAttachmentFile, recordAttachment } from "@/lib/services/attachments";
import { publish } from "@/lib/realtime";

/** Upload a file into a session (allowed before and during the session, not after). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const booking = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!booking || !isParticipant(booking, user.id)) return Response.json({ error: "not_participant" }, { status: 403 });
  if (!(booking.status === "confirmed" || booking.status === "in_progress")) return Response.json({ error: "status" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "empty" }, { status: 400 });
  try {
    const { storedPath, size } = await persistAttachmentFile(id, file);
    const wire = db.transaction((tx) => recordAttachment(tx, { bookingId: id, uploaderId: user.id, fileName: file.name, mime: file.type, size, storedPath }, new Date()));
    publish(id, "message", wire);
    return Response.json({ message: wire });
  } catch (e) {
    if (e instanceof AttachmentError) return Response.json({ error: e.code }, { status: 400 });
    throw e;
  }
}
