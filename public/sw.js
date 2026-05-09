// Service Worker para notificações push — Cajado Sistema

const CACHE_NAME = 'cajado-v1'

self.addEventListener('install', (event) => { self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Cajado Sistema'
  const options = {
    body: data.body || 'Voce tem uma nova notificacao.',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: data.tag || 'cajado-notif',
    data: { url: data.url || '/inicio' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/inicio'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
