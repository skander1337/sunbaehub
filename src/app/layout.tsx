import type { Metadata } from "next";
import "./globals.css";
import { pretendard } from "./fonts";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/provider";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { settleDueBookings } from "@/lib/services/settlement";

export const metadata: Metadata = {
  title: `${BRAND.nameKo} ${BRAND.name} · 선배와 1:1 상담, 크레딧으로`,
  description: "취업 준비생이 검증된 선배와 1:1 상담을 크레딧으로 예약하는 플랫폼. 리뷰가 가격을 정하고, 불만족 시 50%를 돌려드려요.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // Lazy lifecycle: completes ended sessions and settles escrow that is 24h past completion.
  settleDueBookings(db, new Date());
  return (
    <html lang={locale} className={pretendard.variable}>
      <body className="font-sans">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
