import type { TFn, DictKey } from "@/lib/i18n/dictionary";

const TONE: Record<string, string> = {
  confirmed: "tag-brand",
  in_progress: "tag-success",
  completed: "tag-neutral",
  cancelled: "tag-neutral",
  disputed: "tag-warn",
  refunded: "tag-danger",
};

export function StatusTag({ status, t }: { status: string; t: TFn }) {
  const key = `status.${status}` as DictKey;
  return <span className={`tag ${TONE[status] ?? "tag-neutral"}`}>{t(key)}</span>;
}
