import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { dayName } from "@/lib/seoul";
import { saveAvailability } from "@/app/actions/specialist";
import { Notice } from "@/components/Notice";

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const [{ user }, { t, locale }] = await Promise.all([requireSpecialist(), getT()]);
  const rules = db.select().from(schema.availabilityRules).where(eq(schema.availabilityRules.specialistId, user.id)).all();
  const hours = Array.from({ length: 25 }, (_, h) => h);
  const days = [1, 2, 3, 4, 5, 6, 0];
  const sel = "field h-10 w-[92px] px-2 tnum";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{t("sp.avail.title")}</h1>
      <p className="muted mt-2 max-w-[60ch] text-[15px]">{t("sp.avail.sub")}</p>
      <div className="mt-6">{saved && <Notice>{t("sp.avail.saved")}</Notice>}</div>
      <form action={saveAvailability} className="card overflow-x-auto p-6">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12px] font-semibold text-ink-3">
              <th className="pb-3"></th>
              <th className="pb-3">{t("sp.avail.window", { n: 1 })}</th>
              <th className="pb-3">{t("sp.avail.window", { n: 2 })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days.map((d) => {
              const w = rules.filter((r) => r.dayOfWeek === d).sort((a, b) => a.startMinute - b.startMinute).slice(0, 2);
              return (
                <tr key={d}>
                  <td className="py-3 pr-4 font-bold">{dayName(d, locale)}</td>
                  {[0, 1].map((i) => (
                    <td key={i} className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <select name={`d${d}_w${i}_start`} defaultValue={w[i] ? String(w[i].startMinute / 60) : ""} className={sel} aria-label={`${dayName(d, locale)} ${t("sp.avail.window", { n: i + 1 })} ${t("sp.avail.from")}`}>
                          <option value="">{t("sp.avail.none")}</option>
                          {hours.slice(0, 24).map((h) => (
                            <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                        <span className="text-ink-3">–</span>
                        <select name={`d${d}_w${i}_end`} defaultValue={w[i] ? String(w[i].endMinute / 60) : ""} className={sel} aria-label={`${dayName(d, locale)} ${t("sp.avail.window", { n: i + 1 })} ${t("sp.avail.to")}`}>
                          <option value="">{t("sp.avail.none")}</option>
                          {hours.slice(1).map((h) => (
                            <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="submit" className="btn btn-primary mt-6">{t("sp.profile.save")}</button>
      </form>
    </div>
  );
}
