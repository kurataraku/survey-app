import type { NextConfig } from "next";
import { LEGACY_SCHOOL_SLUG_REDIRECTS } from "./lib/seo/gsc-priority-schools";

const legacySchoolRedirects = Object.entries(LEGACY_SCHOOL_SLUG_REDIRECTS).flatMap(
  ([fromSlug, toSlug]) => [
    {
      source: `/schools/${fromSlug}`,
      destination: `/schools/${toSlug}`,
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
  async redirects() {
    return [
      ...legacySchoolRedirects,
      {
        source: "/features/kanto-tsushin-setsumeikai-2024-schedule",
        destination: "/features/kanto-tsushin-setsumeikai-2026-schedule",
        permanent: true,
      },
      {
        source: "/tsushin-kuchikomi/features/kanto-tsushin-setsumeikai-2024-schedule",
        destination: "/tsushin-kuchikomi/features/kanto-tsushin-setsumeikai-2026-schedule",
        permanent: true,
      },
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
