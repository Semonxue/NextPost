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

  // @libsql/* 是 Node.js 原生包，workerd 环境不可用，Workers 用 D1 binding 替代
  // drizzle-orm/libsql 内部 import @libsql/client，必须一起 externalize
  // drizzle-orm/d1 不依赖 @libsql/*，可以正常 bundle
  serverExternalPackages: [
    'sharp',
    'drizzle-orm/libsql',
    '@libsql/client',
    '@libsql/client-wasm',
    '@libsql/core',
    '@libsql/hrana-client',
    '@libsql/isomorphic-fetch',
    '@libsql/isomorphic-ws',
  ],
};

export default nextConfig;

// OpenNext Cloudflare: enables Cloudflare bindings (D1/R2) in local dev
// This must be after the export, at the module level
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
