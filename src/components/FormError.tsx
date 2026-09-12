import { getT } from "@/lib/i18n/server";
import type { DictKey } from "@/lib/i18n/dictionary";

export async function FormError({ code }: { code?: string }) {
  if (!code) return null;
  const { t } = await getT();
  const key = `error.${code}` as DictKey;
  const msg = t(key) === key ? t("error.generic") : t(key);
  return (
    <p role="alert" className="mb-5 rounded-[12px] border border-danger/30 bg-[#fdecec] px-4 py-3 text-[14px] font-medium text-danger">
      {msg}
    </p>
  );
}
