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

  // sharp / @libsql/client 是原生二进制依赖，必须 externalize（Workers 不可用）
  // prisma 和 @prisma/client 不 externalize，让其 WASM 引擎（engineType=wasm）
  // 随 D1 adapter 一起打包进 Workers bundle，避免 fs.readdir 调用
  serverExternalPackages: ['sharp', '@libsql/client'],
};

export default nextConfig;

// OpenNext Cloudflare: enables Cloudflare bindings (D1/R2) in local dev
// This must be after the export, at the module level
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
