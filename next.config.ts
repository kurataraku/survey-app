import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 一覧系の初期HTMLにカード本文を含めるため、PPRによるストリーミング分割を無効化
  experimental: {
    ppr: false,
  },
  async redirects() {
    return [
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
