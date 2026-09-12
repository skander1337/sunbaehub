"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export function ScoreInput({ name, initial = 85 }: { name: string; initial?: number }) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const hint = v >= 90 ? t("review.h.great") : v >= 75 ? t("review.h.good") : v >= 60 ? t("review.h.ok") : t("review.h.bad");
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="tnum text-[44px] leading-none font-extrabold tracking-[-0.03em]">
          {v}
          <span className="text-[16px] font-semibold text-ink-3">/100</span>
        </span>
        <span className={`text-[14px] font-semibold ${v >= 75 ? "text-success" : v >= 60 ? "text-ink-2" : "text-danger"}`}>{hint}</span>
      </div>
      <input
        type="range"
        name={name}
        min={0}
        max={100}
        step={1}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-mist accent-brand"
        aria-label={t("review.score")}
      />
      <div className="tnum mt-1 flex justify-between text-[11.5px] text-ink-3">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
