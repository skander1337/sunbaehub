"use client";

import { useFormStatus } from "react-dom";
import { cancelBooking } from "@/app/actions/booking";
import { useI18n } from "@/lib/i18n/provider";
import type { cancellationQuote } from "@/lib/rules/refund";

type Props = {
  bookingId: string;
  price: number;
  by: "seeker" | "specialist";
  quote: ReturnType<typeof cancellationQuote>;
  quoteChanged?: boolean;
};

function ConfirmCancellation({ amount, by }: { amount: string; by: Props["by"] }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" disabled={pending} className="btn btn-sm btn-danger mt-4 w-full whitespace-normal">
      {pending ? t("cancellation.pending") : t(by === "seeker" ? "cancellation.confirmSeeker" : "cancellation.confirmSpecialist", { n: amount })}
    </button>
  );
}

export function CancellationPreview({ bookingId, price, by, quote, quoteChanged }: Props) {
  const { t, locale } = useI18n();
  const credits = (n: number) => n.toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
  return (
    <details open={quoteChanged || undefined} className="max-w-full text-right open:w-[280px]" data-testid={`cancellation-preview-${bookingId}`}>
      <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-3 hover:text-ink">{t("bookings.cancel")}</summary>
      <form action={cancelBooking} className="mt-3 border-t border-line pt-3 text-left">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="back" value={by === "specialist" ? "/specialist/dashboard" : "/me/bookings"} />
        <input type="hidden" name="expectedRefund" value={quote.seekerRefund} />
        {quoteChanged && <p role="alert" className="mb-3 text-[14px] font-semibold leading-relaxed text-danger">{t("cancellation.changed")}</p>}
        <p className="text-[15px] font-bold leading-relaxed text-ink" aria-live="polite">
          {t(by === "seeker" ? "cancellation.refundSeeker" : "cancellation.refundSpecialist", { n: credits(quote.seekerRefund) })}
        </p>
        <dl className="mt-3 space-y-1.5 text-[14px] text-ink-2">
          {([
            ["cancellation.original", price],
            ["cancellation.fee", quote.platformFee],
            ["cancellation.compensation", quote.specialistPayout],
          ] as const).map(([key, amount]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt>{t(key)}</dt>
              <dd className="tnum shrink-0">{t("common.creditsN", { n: credits(amount) })}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
          {t(by === "specialist" ? "cancellation.specialistPolicy" : quote.outcome === "full_refund" ? "cancellation.fullPolicy" : "cancellation.splitPolicy")}
        </p>
        <ConfirmCancellation amount={credits(quote.seekerRefund)} by={by} />
      </form>
    </details>
  );
}
