import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { isParticipant } from "@/lib/rules/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const a = db.select().from(schema.attachments).where(eq(schema.attachments.id, id)).get();
  if (!a) return new Response("Not found", { status: 404 });
  const booking = db.select({ seekerId: schema.bookings.seekerId, specialistId: schema.bookings.specialistId }).from(schema.bookings).where(eq(schema.bookings.id, a.bookingId)).get();
  if (!booking || (!isParticipant(booking, user.id) && !user.isAdmin)) return new Response("Forbidden", { status: 403 });
  const file = path.join(process.cwd(), a.storedPath); // storedPath is server-generated, never user input
  try {
    const { size } = await stat(file);
    const data = await readFile(file);
    return new Response(data, {
      headers: {
        "Content-Type": a.mime,
        "Content-Length": String(size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
