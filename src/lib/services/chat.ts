import { asc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { attachments, messages, type Attachment, type Message } from "@/db/schema";

export type WireAttachment = { id: string; fileName: string; mime: string; size: number };
export type WireMessage = {
  id: string;
  senderId: string;
  kind: string;
  body: string;
  lang: string;
  translatedBody: string | null;
  attachment: WireAttachment | null;
  createdAt: string;
};

export function serializeMessage(m: Message, a?: Attachment | null): WireMessage {
  return {
    id: m.id,
    senderId: m.senderId,
    kind: m.kind,
    body: m.body,
    lang: m.lang,
    translatedBody: m.translatedBody,
    attachment: a ? { id: a.id, fileName: a.fileName, mime: a.mime, size: a.size } : null,
    createdAt: m.createdAt.toISOString(),
  };
}

export function loadMessages(tx: Tx | Db, bookingId: string): WireMessage[] {
  const rows = tx
    .select({ m: messages, a: attachments })
    .from(messages)
    .leftJoin(attachments, eq(attachments.id, messages.attachmentId))
    .where(eq(messages.bookingId, bookingId))
    .orderBy(asc(messages.createdAt))
    .all();
  return rows.map((r) => serializeMessage(r.m, r.a));
}
