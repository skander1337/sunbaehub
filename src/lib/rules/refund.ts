export const PLATFORM_FEE_RATE = 0.05;
export const CANCEL_FREE_HOURS = 24;

export type RefundSplit = { seekerRefund: number; platformFee: number; specialistPayout: number };

/** Approved dispute or late cancellation: 50% back to the seeker minus the platform fee, the rest to the specialist. */
export function refundSplit(price: number, feeRate = PLATFORM_FEE_RATE): RefundSplit {
  const platformFee = Math.round(price * feeRate);
  const seekerRefund = Math.round(price * 0.5) - platformFee;
  const specialistPayout = price - seekerRefund - platformFee;
  return { seekerRefund, platformFee, specialistPayout };
}

/** Normal settlement after a completed session. */
export function normalSettlement(price: number, feeRate = PLATFORM_FEE_RATE): { platformFee: number; specialistPayout: number } {
  const platformFee = Math.round(price * feeRate);
  return { platformFee, specialistPayout: price - platformFee };
}

export type CancellationOutcome = "full_refund" | "split";

export function cancellationOutcome(startAt: Date, now: Date, by: "seeker" | "specialist"): CancellationOutcome {
  if (by === "specialist") return "full_refund";
  const hoursBefore = (startAt.getTime() - now.getTime()) / 3_600_000;
  return hoursBefore > CANCEL_FREE_HOURS ? "full_refund" : "split";
}
