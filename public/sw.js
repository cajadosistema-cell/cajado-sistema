// public/sw.js — Service Worker completo: Push + Notificações + Click

const CACHE_NAME = 'cajado-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ── Push recebido ──────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let payload = {}
  try { payload = event.data.json() } catch { payload = { title: 'Cajado', body: event.data.text() } }

  const title   = payload.title   || '⏰ Cajado Sistema'
  const options = {
    body:              payload.body    || 'Você tem um lembrete.',
    icon:              '/icons/icon-192.png',
    badge:             '/icons/icon-72.png',
    tag:               payload.tag    || 'cajado-notif-' + Date.now(),
    data:              { url: payload.url || '/inicio', alarmeId: payload.alarmeId },
    vibrate:           [300, 100, 300, 100, 300],
    requireInteraction: payload.requireInteraction ?? true,
    silent:            false,
    // iOS 16.4+ suporta actions
    actions: payload.actions || [
      { action: 'open',    title: '📱 Abrir' },
      { action: 'dismiss', title: '✕ Fechar' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Click na notificação ───────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/inicio'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se já tem aba aberta, foca e navega
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Abre nova aba
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

// ── Notificação fechada ────────────────────────────────────────────────────
self.addEventListener('notificationclose', () => {
  // Pode registrar analytics aqui
})
