import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { chatBlockReason } from "@/lib/rules/session";
import { publish } from "@/lib/realtime";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  const booking = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!booking) return Response.json({ error: "not_participant" }, { status: 403 });
  const reason = chatBlockReason(booking, user.id, new Date());
  if (reason) return Response.json({ error: reason }, { status: 403 });
  publish(id, "typing", { userId: user.id, name: user.name, at: Date.now() });
  return new Response(null, { status: 204 });
}
