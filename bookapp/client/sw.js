// Service worker "passivo": existe só pra permitir instalar o BBB na tela de início
// do celular (isso é um dos requisitos técnicos do navegador para considerar o site
// "instalável"). Ele NÃO guarda nada em cache — toda página, CSS e JS sempre vêm
// direto do servidor. Assim, qualquer atualização que eu fizer aparece na hora,
// sem risco de você ver uma versão antiga do app.
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
