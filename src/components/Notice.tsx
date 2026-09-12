export function Notice({ tone = "success", children }: { tone?: "success" | "info"; children: React.ReactNode }) {
  return (
    <p role="status" className={`mb-5 rounded-[12px] px-4 py-3 text-[14px] font-medium ${tone === "success" ? "bg-[#e9f6ef] text-success" : "bg-brand-tint text-brand-deep"}`}>
      {children}
    </p>
  );
}
