"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export function LocalizedFileInput({ id, name, accept, required, label, descriptionId }: {
  id?: string;
  name: string;
  accept: string;
  required?: boolean;
  label: string;
  descriptionId?: string;
}) {
  const { t } = useI18n();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const statusId = `${inputId}-filename`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const form = inputRef.current?.form;
    const reset = () => setFileName("");
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-3">
      <label className="btn btn-secondary relative shrink-0 cursor-pointer px-3.5 text-[14px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
        {/* Keep the native control focusable for keyboard activation and required-file validation. */}
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="file"
          accept={accept}
          required={required}
          aria-label={label}
          aria-describedby={[descriptionId, statusId].filter(Boolean).join(" ")}
          title={fileName || t("file.noneSelected")}
          onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span aria-hidden="true">{t("file.choose")}</span>
      </label>
      <span id={statusId} role="status" className="min-w-0 break-all text-[13.5px] text-ink-2">
        {fileName || t("file.noneSelected")}
      </span>
    </div>
  );
}
