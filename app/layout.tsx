import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/lib/theme-provider'
import { RegisterServiceWorker } from './register-sw'
import { PWAInstallBanner } from '@/components/shared/PWAInstallBanner'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Cajado Soluções', template: '%s · Cajado' },
  description: 'Sistema integrado de gestão Cajado — financeiro, comercial, WhatsApp, comissões e estratégia corporativa.',
  manifest: '/manifest.json',
  applicationName: 'Cajado',
  keywords: ['gestão', 'financeiro', 'crm', 'cajado', 'sistema'],
  authors: [{ name: 'Cajado Soluções' }],
  // Apple Web App
  appleWebApp: {
    capable: true,
    title: 'Cajado',
    statusBarStyle: 'black-translucent',
    startupImage: [
      { url: '/icons/icon-512.png', media: '(device-width: 390px)' },
    ],
  },
  // Outros
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: '/icons/icon-32.png',  sizes: '32x32',  type: 'image/png' },
      { url: '/icons/icon-96.png',  sizes: '96x96',  type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512.png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1F4A2E' },
    { media: '(prefers-color-scheme: dark)',  color: '#080b14' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        {/* Anti-flash: aplica o tema ANTES do paint inicial */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cajado-theme');var x=t||'dark';document.documentElement.setAttribute('data-theme',x);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        {/* iOS PWA — safe area e splash */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cajado" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-180.png" />
        {/* Microsoft / Windows */}
        <meta name="msapplication-TileColor" content="#1F4A2E" />
        <meta name="msapplication-TileImage" content="/icons/icon-144.png" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* General */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-sans antialiased overscroll-none">
        <ThemeProvider>
          <RegisterServiceWorker />
          <PWAInstallBanner />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
