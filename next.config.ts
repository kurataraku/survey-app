import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
