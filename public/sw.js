// ONLYGAINS service worker — receives war reports and lands them on the
// lock screen. Deliberately minimal: no caching strategy here (the app shell
// stays network-served), just push + click handling.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}

  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'ONLYGAINS', body: 'The board moved. Go look.' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'ONLYGAINS', {
      body: data.body || 'The board moved. Go look.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.eventId || undefined, // same event never stacks twice
      data: { url: data.url || '/dashboard' },
      vibrate: [40, 60, 90],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab and deep-link it; otherwise open fresh.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }

      return self.clients.openWindow(url)
    }),
  )
})
