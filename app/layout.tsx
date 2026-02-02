import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { GoogleAnalyticsInit } from "@/components/GoogleAnalyticsInit";
import StructuredData from "@/components/StructuredData";
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

const appBaseUrl = getAppBaseUrl();

/** Google検索結果のサイト名指定用（ドメインレベルで1つのサイト名を指定） */
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite" as const,
  name: "通信制高校リアルレビュー",
  alternateName: ["キャリアエッセンス"],
  url: appBaseUrl,
};

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <StructuredData data={websiteSchema} />
        <GoogleAnalyticsInit />
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
