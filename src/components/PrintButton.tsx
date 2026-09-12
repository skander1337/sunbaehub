"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-sm btn-outline print:hidden">
      {label}
    </button>
  );
}
