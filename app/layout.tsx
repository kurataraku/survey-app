import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "通信制高校リアルレビュー | 口コミ・評判で選ぶ通信制高校",
    template: "%s | 通信制高校リアルレビュー",
  },
  description: "通信制高校の口コミ・評判を集めたメディアサイト。実際に通った人のリアルな声で、あなたに本当に合う通信制高校を見つけよう。",
  keywords: ["通信制", "通信制高校", "通信制 口コミ", "通信制高校 口コミ", "通信制高校 評判", "通信制高校 選び方"],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "通信制高校リアルレビュー",
    title: "通信制高校リアルレビュー | 口コミ・評判で選ぶ通信制高校",
    description: "通信制高校の口コミ・評判を集めたメディアサイト。実際に通った人のリアルな声で、あなたに本当に合う通信制高校を見つけよう。",
  },
  twitter: {
    card: "summary_large_image",
    title: "通信制高校リアルレビュー | 口コミ・評判で選ぶ通信制高校",
    description: "通信制高校の口コミ・評判を集めたメディアサイト。実際に通った人のリアルな声で、あなたに本当に合う通信制高校を見つけよう。",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 構造化データは静的データのみ（パフォーマンス向上のため）
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  
  // 本番環境では警告を表示
  if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL === 'https://example.com')) {
    console.warn('⚠️ NEXT_PUBLIC_SITE_URLが設定されていません。本番環境では必ず設定してください。');
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "通信制高校リアルレビュー",
    "url": baseUrl,
    "logo": `${baseUrl}/logo-service.png`,
    "description": "通信制高校の口コミ・評判を集めたメディアサイト",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "通信制高校リアルレビュー",
    "url": baseUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/schools?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="ja">
      <head>
        <StructuredData data={organizationSchema} />
        <StructuredData data={websiteSchema} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
