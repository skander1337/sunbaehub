"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconArrow } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";
import { GRACE_MIN } from "@/lib/rules/session";

type Props = {
  bookingId: string;
  startAt: number;
  endAt: number;
  serverNow: number;
  canEnter: boolean;
};

export function SessionEntryButton({ bookingId, startAt, endAt, serverNow, canEnter }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const early = serverNow < startAt;

  useEffect(() => {
    // The server decides access. Refresh at its next boundary rather than
    // unlocking against the student's or specialist's device clock.
    const boundary = early ? startAt : endAt + GRACE_MIN * 60_000 + 1;
    const entryPath = window.location.pathname;
    const refresh = () => {
      if (window.location.pathname === entryPath) router.refresh();
    };
    const delay = boundary - serverNow;
    const timer = delay > 0 ? setTimeout(refresh, Math.min(delay + 50, 2_147_483_647)) : undefined;
    return () => {
      clearTimeout(timer);
    };
  }, [early, startAt, endAt, serverNow, router]);

  if (canEnter) {
    return (
      <Link href={`/sessions/${bookingId}`} prefetch={false} className="btn btn-sm btn-primary">
        {t("bookings.enter")} <IconArrow size={16} />
      </Link>
    );
  }

  return (
    <div className="flex max-w-[240px] flex-col items-end gap-1.5">
      <button type="button" disabled className="btn btn-sm btn-secondary" aria-describedby={`entry-hint-${bookingId}`}>
        {early ? t("bookings.notStarted") : t("bookings.entryClosed")}
      </button>
      <p id={`entry-hint-${bookingId}`} className="text-right text-[13px] leading-relaxed text-ink-2">
        {early ? t("bookings.entryHint") : t("session.closed")}
      </p>
    </div>
  );
}
