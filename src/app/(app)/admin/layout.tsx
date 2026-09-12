import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const { t } = await getT();
  const n = (q: number | undefined) => Number(q ?? 0);
  const counts = {
    flags: n(db.select({ n: sql<number>`count(*)` }).from(schema.reviewFlags).where(eq(schema.reviewFlags.status, "open")).get()?.n),
    disputes: n(db.select({ n: sql<number>`count(*)` }).from(schema.disputes).where(eq(schema.disputes.status, "open")).get()?.n),
    verifications: n(db.select({ n: sql<number>`count(*)` }).from(schema.specialistProfiles).where(eq(schema.specialistProfiles.verification, "pending")).get()?.n),
    withdrawals: n(db.select({ n: sql<number>`count(*)` }).from(schema.withdrawalRequests).where(and(eq(schema.withdrawalRequests.status, "pending"))).get()?.n),
  };
  const tabs = [
    { href: "/admin", label: t("admin.tools"), count: null },
    { href: "/admin/flags", label: t("admin.flags"), count: counts.flags },
    { href: "/admin/disputes", label: t("admin.disputes"), count: counts.disputes },
    { href: "/admin/verifications", label: t("admin.verifications"), count: counts.verifications },
    { href: "/admin/withdrawals", label: t("admin.withdrawals"), count: counts.withdrawals },
  ];
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="h1">{t("admin.title")}</h1>
      <p className="muted mt-1 text-[15px]">{t("admin.sub")}</p>
      <nav className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4" aria-label="Admin sections">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="btn btn-sm btn-secondary">
            {tab.label}
            {tab.count !== null && tab.count > 0 && <span className="tnum rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">{tab.count}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
