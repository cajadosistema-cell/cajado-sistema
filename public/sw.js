// Service Worker — Sistema Cajado
// Arquivo: /public/sw.js
// Versão: 2.0.0 — atualize ao mudar este arquivo pra forçar reload em todos os clients

const SW_VERSION = 'cajado-sw-v2.1.0'
const RUNTIME_CACHE = `${SW_VERSION}-runtime`
const OFFLINE_URL = '/offline'

// URLs essenciais pra precachar (mantém mínimo pra não pesar)
const PRECACHE_URLS = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.json',
]

// ============================================================
// INSTALL — precacheia recursos essenciais
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Precache falhou:', err))
  )
})

// ============================================================
// ACTIVATE — limpa caches antigos
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('cajado-sw-') && !key.startsWith(SW_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// ============================================================
// FETCH — network-first com fallback pra cache (e offline)
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Só intercepta GET — POST/PUT/DELETE passam direto
  if (request.method !== 'GET') return

  // Não intercepta requests de outras origens (Supabase, APIs externas)
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Pula extensões e chrome:// urls
  if (!url.protocol.startsWith('http')) return

  // Pula API routes do Next (deixa o servidor responder direto)
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cacheia respostas válidas em runtime
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Offline — tenta servir do cache, senão página offline
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Se foi navegação de página, mostra página offline
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
      })
  )
})

// ============================================================
// PUSH — recebe notificações do servidor
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Cajado', body: event.data.text() }
  }

  const options = {
    body: data.body || 'Nova mensagem',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'cajado-default',
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Cajado', options)
  )
})

// ============================================================
// NOTIFICATION CLICK — abre/foca janela e navega pra URL certa
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Trata actions específicas (se a notificação tinha botões customizados)
  let targetUrl = '/'
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url
  }

  // Se clicou em uma action específica, pode sobrescrever a URL
  if (event.action && event.notification.data && event.notification.data.actions) {
    const actionData = event.notification.data.actions[event.action]
    if (actionData && actionData.url) {
      targetUrl = actionData.url
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem janela do Cajado aberta, foca e navega
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          if ('navigate' in client) {
            return client.navigate(targetUrl)
          }
          return client
        }
      }
      // Senão abre nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// ============================================================
// PUSH SUBSCRIPTION CHANGE — renova subscription quando expira
// ============================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSubscription) => {
        // Avisa o backend sobre a nova subscription
        return fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
            newSubscription,
          }),
        })
      })
      .catch((err) => console.error('[SW] Resubscribe falhou:', err))
  )
})

// ============================================================
// MESSAGE — comunicação client → SW (útil pra forçar update)
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION })
  }
})
