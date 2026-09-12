import { and, asc, eq, gt } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { chatBlockReason, isParticipant } from "@/lib/rules/session";
import { touchSession } from "@/lib/services/booking";
import { detectLang, translate } from "@/lib/translate";

export const dynamic = "force-dynamic";

const serialize = (m: typeof schema.messages.$inferSelect) => ({
  id: m.id,
  senderId: m.senderId,
  kind: m.kind,
  body: m.body,
  lang: m.lang,
  translatedBody: m.translatedBody,
  createdAt: m.createdAt.toISOString(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const booking = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!booking || !isParticipant(booking, user.id)) return Response.json({ error: "not_participant" }, { status: 403 });
  const after = new URL(req.url).searchParams.get("after");
  let rows;
  if (after) {
    const last = db.select({ createdAt: schema.messages.createdAt }).from(schema.messages).where(eq(schema.messages.id, after)).get();
    rows = last
      ? db.select().from(schema.messages).where(and(eq(schema.messages.bookingId, id), gt(schema.messages.createdAt, last.createdAt))).orderBy(asc(schema.messages.createdAt)).all()
      : [];
  } else {
    rows = db.select().from(schema.messages).where(eq(schema.messages.bookingId, id)).orderBy(asc(schema.messages.createdAt)).all();
  }
  return Response.json({ status: booking.status, endAt: booking.endAt.toISOString(), messages: rows.map(serialize) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const now = new Date();
  const booking = db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).get();
  if (!booking) return Response.json({ error: "not_found" }, { status: 404 });
  const reason = chatBlockReason(booking, user.id, now);
  if (reason) return Response.json({ error: reason }, { status: 403 });
  const payload = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (payload?.text ?? "").trim().slice(0, 2000);
  if (!text) return Response.json({ error: "empty" }, { status: 400 });

  const lang = detectLang(text);
  const tr = translate(text, lang, lang === "ko" ? "en" : "ko");
  const row = db.transaction((tx) => {
    touchSession(tx, booking, now);
    const mid = crypto.randomUUID();
    tx.insert(schema.messages)
      .values({ id: mid, bookingId: id, senderId: user.id, kind: "text", body: text, lang, translatedBody: tr.matched ? tr.text : null, createdAt: now })
      .run();
    return tx.select().from(schema.messages).where(eq(schema.messages.id, mid)).get()!;
  });
  return Response.json({ message: serialize(row) });
}
