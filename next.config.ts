import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 适配
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
    // 允许 R2 存储的图片
    unoptimized: false,
  },

  // 把运行时二进制依赖剔出打包（Next.js 16 顶层配置）
  serverExternalPackages: ['sharp', 'prisma', '@prisma/client'],

  // 阻止 Turbopack 追踪 uploads 目录（本地开发存储，非生产资源）
  outputFileTracingExcludes: {
    '**/*': ['./uploads/**'],
  },

  // 实验性功能
  experimental: {
    // 启用 serverActions 支持 Cloudflare
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'production'
        ? ['*.pages.dev', '*.cloudflare.dev']
        : ['localhost:3456', 'localhost:3000'],
    },
  },
};

export default nextConfig;
