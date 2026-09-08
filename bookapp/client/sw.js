// Service worker: permite instalar o BBB na tela de início do celular, e também mostra as
// notificações push de verdade (chegam mesmo com o app fechado). Ele NÃO guarda nada em
// cache pra páginas/CSS/JS — tudo sempre vem direto do servidor, então qualquer atualização
// que eu fizer aparece na hora, sem risco de você ver uma versão antiga do app.
const CACHE_PREFIX = 'bbb-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // limpa qualquer cache de versões antigas do app (de quando ele ainda guardava coisas em cache)
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // sempre rede, sem cache algum
  e.respondWith(fetch(e.request));
});

// Chegou uma notificação push do servidor — mostra ela mesmo com o app fechado.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'BBB 📖', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'BBB 📖';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tocou na notificação — abre (ou foca) o app já na tela certa.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    }),
  );
});
