import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { IconPaperclip } from "@/components/icons";

// Only render inside a participant's booking list. Preparation files stay
// accessible without opening the chat room before the appointment.
export function BookingAttachments({ bookingId, startAt, label }: { bookingId: string; startAt: Date; label: string }) {
  const files = db.select({ id: schema.attachments.id, fileName: schema.attachments.fileName })
    .from(schema.attachments)
    .where(and(eq(schema.attachments.bookingId, bookingId), lt(schema.attachments.createdAt, startAt)))
    .all();
  if (!files.length) return null;

  return (
    <div className="mt-3 text-[13px] text-ink-2">
      <p className="font-semibold">{label}</p>
      <ul className="mt-1 space-y-1">
        {files.map((file) => (
          <li key={file.id}>
            <a href={`/api/files/attachments/${file.id}`} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-start gap-1.5 font-medium text-brand underline underline-offset-2">
              <IconPaperclip size={15} className="mt-0.5 shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{file.fileName}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
