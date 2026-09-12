import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { attachments, messages } from "@/db/schema";
import { serializeMessage, type WireMessage } from "./chat";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

export class AttachmentError extends Error {
  constructor(public code: "file_type" | "file_size" | "empty") {
    super(code);
  }
}

export function validateAttachment(file: File): { ext: string } {
  if (file.size === 0) throw new AttachmentError("empty");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError("file_size");
  const ext = EXT[file.type];
  if (!ext) throw new AttachmentError("file_type");
  return { ext };
}

/** Writes the file under uploads/attachments/<bookingId>/ and returns the server-generated relative path. */
export async function persistAttachmentFile(bookingId: string, file: File): Promise<{ storedPath: string; size: number }> {
  const { ext } = validateAttachment(file);
  const dir = path.join(process.cwd(), "uploads", "attachments", bookingId);
  await mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { storedPath: `uploads/attachments/${bookingId}/${name}`, size: file.size };
}

/** Inserts the attachment row and its "file" chat message. Call after persistAttachmentFile, inside a transaction. */
export function recordAttachment(
  tx: Tx | Db,
  input: { bookingId: string; uploaderId: string; fileName: string; mime: string; size: number; storedPath: string },
  now: Date,
): WireMessage {
  const attachmentId = crypto.randomUUID();
  tx.insert(attachments)
    .values({ id: attachmentId, bookingId: input.bookingId, uploaderId: input.uploaderId, fileName: input.fileName.slice(0, 200), storedPath: input.storedPath, mime: input.mime, size: input.size, createdAt: now })
    .run();
  const messageId = crypto.randomUUID();
  tx.insert(messages)
    .values({ id: messageId, bookingId: input.bookingId, senderId: input.uploaderId, kind: "file", body: input.fileName.slice(0, 200), lang: "ko", translatedBody: null, attachmentId, createdAt: now })
    .run();
  const m = tx.select().from(messages).where(eq(messages.id, messageId)).get()!;
  const a = tx.select().from(attachments).where(eq(attachments.id, attachmentId)).get()!;
  return serializeMessage(m, a);
}
