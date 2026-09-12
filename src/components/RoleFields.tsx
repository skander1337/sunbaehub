"use client";

import { useState } from "react";

type Labels = { role: string; seeker: string; expert: string; expertHint: string; affiliation: string; affiliationPh: string };

export function RoleFields({ initialRole, labels }: { initialRole: "seeker" | "expert"; labels: Labels }) {
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
      {role === "seeker" ? (
        <div>
          <label htmlFor="affiliation" className="mb-1.5 block text-[13px] font-semibold text-ink-3">{labels.affiliation}</label>
          <input id="affiliation" name="affiliation" maxLength={80} placeholder={labels.affiliationPh} className="field" />
        </div>
      ) : (
        <p className="rounded-[12px] bg-brand-tint px-4 py-3 text-[13.5px] leading-relaxed text-brand-deep">{labels.expertHint}</p>
      )}
    </>
  );
}
