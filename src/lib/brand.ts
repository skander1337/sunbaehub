export const BRAND = {
  name: "SunbaeHub",
  nameKo: "선배허브",
  /** Shown wherever the product name appears in full. */
  full: "SunbaeHub · 선배허브",
  creditsToWon: 100, // 1 credit ≈ ₩100 (display only)
  platformFeeRate: 0.05,
  durations: [30, 60] as const, // bookable session lengths in minutes
  slotStepMinutes: 30, // start times are offered every 30 minutes
  trialMinutes: 30,
  seekerSignupGrant: 70, // covers one 30-minute session with any specialist whose 60-minute rate is ≤ 140 credits
} as const;
