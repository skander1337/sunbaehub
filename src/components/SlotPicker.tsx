"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { createBooking } from "@/app/actions/booking";
import { IconArrow } from "./icons";

export type PickerDay = { dateKey: string; dayName: string; dateLabel: string; isToday: boolean; slots: { iso: string; time: string }[] };

export function SlotPicker(props: {
  specialistId: string;
  days: PickerDay[]; // 60-minute sessions
  days30: PickerDay[]; // 30-minute sessions
  price: number; // 60 minutes
  price30: number;
  balance: number | null;
  categories: { id: string; label: string }[];
  loginHref: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const affordable60 = props.balance === null || props.balance >= props.price;
  const [duration, setDuration] = useState<30 | 60>(affordable60 ? 60 : 30);
  const days = duration === 60 ? props.days : props.days30;
  const price = duration === 60 ? props.price : props.price30;
  const firstWithSlots = days.findIndex((d) => d.slots.length > 0);
  const [dayIdx, setDayIdx] = useState(firstWithSlots >= 0 ? firstWithSlots : 0);
  const [slot, setSlot] = useState<string | null>(null);
  const [category, setCategory] = useState(props.categories[0]?.id ?? "");
  const day = days[dayIdx];
  const after = useMemo(() => (props.balance === null ? null : props.balance - price), [props.balance, price]);
  const canSubmit = !!slot && !!category && props.balance !== null && after !== null && after >= 0 && !props.disabled;

  return (
    <form action={createBooking} className="min-w-0 space-y-6">
      <input type="hidden" name="specialistId" value={props.specialistId} />
      <input type="hidden" name="startAt" value={slot ?? ""} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="durationMin" value={duration} />

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink-3">{t("profile.duration")}</div>
        <div className="grid grid-cols-2 gap-2">
          {([30, 60] as const).map((m) => {
            const active = duration === m;
            const p = m === 60 ? props.price : props.price30;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setDuration(m);
                  setSlot(null);
                  const nd = m === 60 ? props.days : props.days30;
                  const i = nd.findIndex((d) => d.slots.length > 0);
                  setDayIdx(i >= 0 ? i : 0);
                }}
                className={`flex items-baseline justify-between rounded-[12px] border px-4 py-3 text-left transition-colors duration-150 ${
                  active ? "border-brand bg-brand-tint text-brand-deep" : "border-line bg-paper text-ink hover:border-brand"
                }`}
              >
                <span className="text-[15px] font-bold">{m === 30 ? t("profile.min30") : t("profile.min60")}</span>
                <span className="tnum text-[13.5px] font-semibold">{t("common.creditsN", { n: p })}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink-3">{t("profile.pickDay")}</div>
        <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
          {days.map((d, i) => {
            const active = i === dayIdx;
            const empty = d.slots.length === 0;
            return (
              <button
                key={d.dateKey}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={empty}
                onClick={() => {
                  setDayIdx(i);
                  setSlot(null);
                }}
                className={`flex w-[58px] shrink-0 flex-col items-center rounded-[12px] px-2 py-2 text-center transition-colors duration-150 ${
                  active ? "bg-ink text-white" : empty ? "text-ink-3/50" : "bg-mist text-ink hover:bg-brand-tint hover:text-brand-deep"
                }`}
              >
                <span className="text-[12px] font-medium">{d.isToday ? t("profile.today") : d.dayName}</span>
                <span className="tnum text-[15px] font-bold">{d.dateLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink-3">{t("profile.pickTime")}</div>
        {day && day.slots.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {day.slots.map((s) => {
              const active = slot === s.iso;
              return (
                <button
                  key={s.iso}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSlot(s.iso)}
                  className={`tnum h-10 rounded-[12px] px-4 text-[14.5px] font-semibold transition-colors duration-150 ${
                    active ? "bg-brand text-white" : "border border-line bg-paper text-ink hover:border-brand hover:text-brand-deep"
                  }`}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted text-[14px]">{t("profile.noSlots")}</p>
        )}
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-ink-3">{t("profile.category")}</div>
        <div className="flex flex-wrap gap-2">
          {props.categories.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.id)}
                className={`h-10 rounded-[12px] px-4 text-[14px] font-semibold transition-colors duration-150 ${
                  active ? "bg-brand-tint text-brand-deep ring-1 ring-brand/40 ring-inset" : "bg-mist text-ink hover:bg-brand-tint hover:text-brand-deep"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="note" className="mb-2 block text-[13px] font-semibold text-ink-3">
          {t("profile.note")}
        </label>
        <textarea id="note" name="note" className="textarea" placeholder={t("profile.notePh")} maxLength={500} />
      </div>

      <div>
        <label htmlFor="attachment" className="mb-2 block text-[13px] font-semibold text-ink-3">
          {t("profile.attachment")}
        </label>
        <input
          id="attachment"
          name="attachment"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="block w-full text-[13.5px] text-ink-2 file:mr-3 file:rounded-[10px] file:border-0 file:bg-mist file:px-3.5 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-brand-tint"
        />
        <p className="mt-1.5 text-[12px] text-ink-3">{t("profile.attachmentHint")}</p>
      </div>

      <div className="hairline pt-5">
        <div className="flex items-center justify-between text-[14px]">
          <span className="muted">{t("profile.sessionN", { n: duration })}</span>
          <span className="tnum font-bold">{t("common.creditsN", { n: price })}</span>
        </div>
        {props.balance !== null && after !== null && (
          <div className="mt-1.5 flex items-center justify-between text-[14px]">
            <span className="muted">
              {t("profile.balance")} → {t("profile.after")}
            </span>
            <span className={`tnum font-semibold ${after < 0 ? "text-danger" : "text-ink-2"}`}>
              {props.balance.toLocaleString()} → {after.toLocaleString()}
            </span>
          </div>
        )}
        {props.balance === null ? (
          <a href={props.loginHref} className="btn btn-primary mt-4 w-full">
            {t("profile.loginToBook")}
          </a>
        ) : (
          <button type="submit" disabled={!canSubmit} className="btn btn-primary mt-4 w-full">
            {slot ? t("profile.book") : t("profile.selectSlot")}
            <IconArrow size={18} />
          </button>
        )}
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">{t("profile.hold", { n: price })}</p>
      </div>
    </form>
  );
}
