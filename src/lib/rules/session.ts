export const GRACE_MIN = 5;

export type SessionWindow = "early" | "open" | "closed";

export function sessionWindow(b: { startAt: Date; endAt: Date }, now: Date, graceMin = GRACE_MIN): SessionWindow {
  const g = graceMin * 60_000;
  if (now.getTime() < b.startAt.getTime() - g) return "early";
  if (now.getTime() > b.endAt.getTime() + g) return "closed";
  return "open";
}

export type SessionBooking = { startAt: Date; endAt: Date; status: string; seekerId: string; specialistId: string };

export function isParticipant(b: { seekerId: string; specialistId: string }, userId: string): boolean {
  return b.seekerId === userId || b.specialistId === userId;
}

export function canChat(b: SessionBooking, userId: string, now: Date): boolean {
  return (
    isParticipant(b, userId) &&
    (b.status === "confirmed" || b.status === "in_progress") &&
    sessionWindow(b, now) === "open"
  );
}

export function chatBlockReason(b: SessionBooking, userId: string, now: Date): "not_participant" | "status" | "early" | "closed" | null {
  if (!isParticipant(b, userId)) return "not_participant";
  if (b.status !== "confirmed" && b.status !== "in_progress") return "status";
  const w = sessionWindow(b, now);
  if (w === "early") return "early";
  if (w === "closed") return "closed";
  return null;
}
