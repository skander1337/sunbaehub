"use client";

import { useState } from "react";

type Labels = { role: string; seeker: string; expert: string; headline: string; headlinePh: string; categories: string; basePrice: string };

export function RoleFields({ initialRole, labels, categories }: { initialRole: "seeker" | "expert"; labels: Labels; categories: { id: string; label: string }[] }) {
  const [role, setRole] = useState<"seeker" | "expert">(initialRole);
  const opt = (value: "seeker" | "expert", text: string) => (
    <label className="cursor-pointer">
      <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="peer sr-only" />
      <span className="block rounded-[12px] border border-line px-4 py-3 text-[14px] font-semibold transition-colors duration-150 peer-checked:border-brand peer-checked:bg-brand-tint peer-checked:text-brand-deep peer-focus-visible:outline-2 peer-focus-visible:outline-brand hover:border-brand">
        {text}
      </span>
    </label>
  );
  return (
    <>
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-semibold text-ink-3">{labels.role}</legend>
        <div className="grid grid-cols-2 gap-2">
          {opt("seeker", labels.seeker)}
          {opt("expert", labels.expert)}
        </div>
      </fieldset>
      {role === "expert" && (
        <div className="space-y-5 border-t border-line pt-5">
          <div>
            <label htmlFor="headline" className="mb-1.5 block text-[13px] font-semibold text-ink-3">{labels.headline}</label>
            <input id="headline" name="headline" required maxLength={80} placeholder={labels.headlinePh} className="field" />
          </div>
          <fieldset>
            <legend className="mb-1.5 block text-[13px] font-semibold text-ink-3">{labels.categories}</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label key={c.id} className="cursor-pointer">
                  <input type="checkbox" name="categories" value={c.id} className="peer sr-only" />
                  <span className="block rounded-[10px] bg-mist px-3.5 py-2 text-[14px] font-semibold transition-colors duration-150 peer-checked:bg-brand-tint peer-checked:text-brand-deep peer-checked:ring-1 peer-checked:ring-brand/40 peer-checked:ring-inset peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="basePrice" className="mb-1.5 block text-[13px] font-semibold text-ink-3">{labels.basePrice}</label>
            <input id="basePrice" name="basePrice" type="number" min={10} max={1000} step={5} defaultValue={100} required className="field tnum max-w-[200px]" />
          </div>
        </div>
      )}
    </>
  );
}
