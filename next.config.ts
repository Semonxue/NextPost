import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 允许上传目录作为静态文件服务
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
