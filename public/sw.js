// Service Worker para Web Push Notifications
// Arquivo: /public/sw.js

self.addEventListener('push', function (event) {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Cajado', body: event.data.text() }
  }

  const options = {
    body: data.body || 'Nova mensagem',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'cajado-chat',
    data: { url: data.url || '/comunicacao' },
    actions: [
      { action: 'open', title: 'Abrir chat' },
    ],
    vibrate: [200, 100, 200],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '💬 Cajado', options)
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/comunicacao'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Se já tem uma janela aberta, foca ela e navega
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          return client.navigate(targetUrl)
        }
      }
      // Senão abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// Ativa o SW imediatamente sem esperar reload
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
