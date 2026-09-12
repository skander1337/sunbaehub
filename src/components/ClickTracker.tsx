"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export function ClickTracker({ postId }: { postId: string }) {
  const { t } = useI18n();
  const [rewarded, setRewarded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${postId}/click`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rewarded?: boolean } | null) => {
        if (!cancelled && d?.rewarded) setRewarded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId]);
  if (!rewarded) return null;
  return <p className="tag tag-success mt-4">{t("posts.rewardHint")}</p>;
}
