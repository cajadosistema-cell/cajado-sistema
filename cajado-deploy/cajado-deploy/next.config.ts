import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Necessário para deploy no Railway com Dockerfile
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.railway.app',
        '*.up.railway.app',
      ],
    },
  },
}

export default nextConfig
