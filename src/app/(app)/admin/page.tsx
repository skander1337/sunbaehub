import { getT } from "@/lib/i18n/server";
import { runScan, settleNow } from "@/app/actions/admin";
import { Notice } from "@/components/Notice";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ scanned?: string; flagged?: string; settled?: string }> }) {
  const sp = await searchParams;
  const { t } = await getT();
  return (
    <div>
      {sp.scanned && <Notice>{t("admin.scanDone", { n: sp.scanned, m: sp.flagged ?? 0 })}</Notice>}
      {sp.settled && <Notice>{t("admin.settleDone", { n: sp.settled })}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <form action={runScan} className="card p-5">
          <div className="text-[15px] font-bold">{t("admin.scan")}</div>
          <p className="muted mt-1 text-[13.5px]">reciprocal_7d · booking_ring_14d · repeat_reviewer_30d · burst_high_24h · new_account · instant_empty</p>
          <button type="submit" className="btn btn-sm btn-primary mt-4">{t("admin.scan")}</button>
        </form>
        <form action={settleNow} className="card p-5">
          <div className="text-[15px] font-bold">{t("admin.settle")}</div>
          <p className="muted mt-1 text-[13.5px]">{t("landing.creditsRow2d")}</p>
          <button type="submit" className="btn btn-sm btn-outline mt-4">{t("admin.settle")}</button>
        </form>
      </div>
    </div>
  );
}
