import type { NextConfig } from "next";
import { LEGACY_SCHOOL_SLUG_REDIRECTS } from "./lib/seo/gsc-priority-schools";
import { ARTICLE_IMAGE_PATH_PREFIX, getArticleImageHost } from "./lib/images/articleImages";

const articleImageHost = getArticleImageHost();

// ベースパスなしの旧URLは、middleware での再リダイレクトを挟まないよう直接ベースパス付きへ送る
const legacySchoolRedirects = Object.entries(LEGACY_SCHOOL_SLUG_REDIRECTS).flatMap(
  ([fromSlug, toSlug]) => [
    {
      source: `/schools/${fromSlug}`,
      destination: `/tsushin-kuchikomi/schools/${toSlug}`,
      permanent: true,
    },
    {
      source: `/tsushin-kuchikomi/schools/${fromSlug}`,
      destination: `/tsushin-kuchikomi/schools/${toSlug}`,
      permanent: true,
    },
  ]
);

const nextConfig: NextConfig = {
  // 一覧系の初期HTMLにカード本文を含めるため、PPRによるストリーミング分割を無効化
  experimental: {
    ppr: false,
  },
  images: {
    remotePatterns: articleImageHost
      ? [{ protocol: "https", hostname: articleImageHost, pathname: `${ARTICLE_IMAGE_PATH_PREFIX}**` }]
      : [],
    // 記事画像はアップロードごとに一意のファイル名になるため、変換結果を長期キャッシュして再変換を抑える
    minimumCacheTTL: 60 * 60 * 24 * 31,
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      ...legacySchoolRedirects,
      {
        source: "/features/kanto-tsushin-setsumeikai-2024-schedule",
        destination: "/tsushin-kuchikomi/features/kanto-tsushin-setsumeikai-2026-schedule",
        permanent: true,
      },
      {
        source: "/tsushin-kuchikomi/features/kanto-tsushin-setsumeikai-2024-schedule",
        destination: "/tsushin-kuchikomi/features/kanto-tsushin-setsumeikai-2026-schedule",
        permanent: true,
      },
    ];
  },
  async headers() {
    // 口コミ一覧は searchParams で絞り込むため毎回サーバー描画になる。利用者ごとに変わる内容はないので、
    // Next.js が上書きしない Vercel 専用ヘッダーで CDN に短時間キャッシュさせる（クエリ文字列ごとに別キャッシュ）
    const reviewsListCache = [
      {
        key: "Vercel-CDN-Cache-Control",
        value: "max-age=300, stale-while-revalidate=3600",
      },
    ];
    return [
      { source: "/tsushin-kuchikomi/reviews", headers: reviewsListCache },
      { source: "/reviews", headers: reviewsListCache },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/company" },
        { source: "/tsushin-kuchikomi", destination: "/" },
        { source: "/tsushin-kuchikomi/", destination: "/" },
        { source: "/tsushin-kuchikomi/api/:path*", destination: "/api/:path*" },
        { source: "/tsushin-kuchikomi/:path*", destination: "/:path*" },
      ],
    };
  },
};

export default nextConfig;
