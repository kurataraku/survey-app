import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: BASE_PATH, permanent: false }];
  },
  async rewrites() {
    return [
      { source: "/tsushin-kuchikomi", destination: "/" },
      { source: "/tsushin-kuchikomi/", destination: "/" },
      { source: "/tsushin-kuchikomi/api/:path*", destination: "/api/:path*" },
      { source: "/tsushin-kuchikomi/:path*", destination: "/:path*" },
    ];
  },
};

export default nextConfig;
