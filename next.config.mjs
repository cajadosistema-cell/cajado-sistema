/** @type {import('next').NextConfig} */
const nextConfig = {
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
        '*.cajadosolucoes.com.br',
      ],
    },
  },

  // Proxy para o backend Express — elimina CORS e problema de variável no build
  async rewrites() {
    const backendUrl = process.env.INBOX_BACKEND_URL || 'http://localhost:3001'
    return [
      {
        source: '/inbox-proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ]
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
