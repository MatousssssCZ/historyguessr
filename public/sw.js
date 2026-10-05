/* HistoryGuesser service worker — pouze push notifikace.
   Záměrně NEzachytává fetch (žádné offline cachování), ať nekoliduje
   s detekcí nových verzí (UpdateWatcher). */

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'HistoryGuesser'
  // U posla denní výzvy nabídni akce „Zahrát teď" / „Později".
  const actions = data.tag === 'daily-messenger'
    ? [{ action: 'play', title: 'Zahrát teď' }, { action: 'later', title: 'Později' }]
    : (Array.isArray(data.actions) ? data.actions : [])
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'historyguesser',
    data: { url: data.url || '/' },
    actions,
    renotify: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'later') return   // „Později" — jen zavřít
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
