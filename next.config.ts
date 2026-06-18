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
  
  // 实验性功能
  experimental: {
    // 启用 serverActions 支持 Cloudflare
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'production' 
        ? ['*.pages.dev', '*.cloudflare.dev']
        : ['localhost:3456', 'localhost:3000'],
    },
  },
  
  // Cloudflare Pages 构建配置
  // 输出目录已经在 wrangler.toml 中指定为 .next
};

export default nextConfig;
