import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { GoogleAnalyticsInit } from "@/components/GoogleAnalyticsInit";
import { AnalyticsEngagement } from "@/components/AnalyticsEngagement";
import { getAppBaseUrl } from "@/lib/env-check";
import "./globals.css";

const appBaseUrl = getAppBaseUrl();

/** 本番では NEXT_PUBLIC_SITE_URL を設定すること。未設定時は example.com になる */
export const metadataBase = new URL(appBaseUrl);

export const metadata: Metadata = {
  title: { default: "通信制高校リアルレビュー", template: "%s" },
  description: "通信制高校の口コミ・評判を集めたメディアサイト。実際に通った人のリアルな声で、あなたに本当に合う通信制高校を見つけよう。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased flex flex-col min-h-screen">
        <GoogleAnalyticsInit />
        <GoogleAnalytics />
        <AnalyticsEngagement />
        <Analytics />
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
