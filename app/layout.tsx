import type { Metadata } from "next";
import { Geist, Geist_Mono, M_PLUS_2 } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { GoogleAnalyticsInit } from "@/components/GoogleAnalyticsInit";
import { AnalyticsEngagement } from "@/components/AnalyticsEngagement";
import { getAppBaseUrl } from "@/lib/env-check";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** ヒーローなど短いコピー用（幾何学的で読みやすい日本語サンセリフ） */
const mPlus2 = M_PLUS_2({
  variable: "--font-mplus-2",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mPlus2.variable} antialiased flex flex-col min-h-screen`}
      >
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
