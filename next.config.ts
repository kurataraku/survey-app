import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 一覧系の初期HTMLにカード本文を含めるため、PPRによるストリーミング分割を無効化
  experimental: {
    ppr: false,
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
