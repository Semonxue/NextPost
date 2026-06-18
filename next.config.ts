import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers 适配
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
    // CF Workers 无法运行 sharp 原生模块，图片走 R2 直出
    unoptimized: true,
  },

  // sharp/prisma 是运行时原生依赖，不打包进 Workers bundle
  serverExternalPackages: ['sharp', 'prisma', '@prisma/client'],
};

export default nextConfig;

// OpenNext Cloudflare: enables Cloudflare bindings (D1/R2) in local dev
// This must be after the export, at the module level
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
