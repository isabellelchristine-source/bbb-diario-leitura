// router.js — roteador simples baseado em hash, sem dependências.
let routes = [];

export function resetRoutes() {
  routes = [];
}

export function addRoute(pattern, handler) {
  // pattern: '/book/:id' -> regex com grupos nomeados
  const paramNames = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  const regex = new RegExp(`^${regexStr}$`);
  routes.push({ regex, paramNames, handler });
}

let currentCleanup = null;

export function navigate(path) {
  window.location.hash = path;
}

// Guarda contra "renderização atrasada": se você toca em Estante e logo em seguida em
// Notificações, a tela de Estante pode levar mais tempo pra carregar (rede mais lenta
// naquele momento) e só terminar DEPOIS da de Notificações — sem isso, ela sobrescreveria
// a tela certa com um conteúdo de uma aba que você já não está mais vendo. Cada navegação
// pega um número (token); cada view confere, antes de desenhar o conteúdo final, se o
// token dela ainda é o mais atual — se não for, ela aborta silenciosamente.
let renderToken = 0;
export function getRenderToken() {
  return renderToken;
}

export async function resolveRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/home';
  const [pathOnly] = hash.split('?');
  const query = new URLSearchParams(hash.split('?')[1] || '');

  for (const route of routes) {
    const match = pathOnly.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      if (typeof currentCleanup === 'function') {
        try { currentCleanup(); } catch (e) { /* noop */ }
      }
      renderToken += 1;
      const myToken = renderToken;
      currentCleanup = await route.handler(params, query);
      if (myToken === renderToken) window.scrollTo(0, 0);
      return;
    }
  }
  navigate('/home');
}

let routerStarted = false;

export function startRouter() {
  if (!routerStarted) {
    window.addEventListener('hashchange', resolveRoute);
    routerStarted = true;
  }
  resolveRoute();
}

export function currentPath() {
  return (window.location.hash.replace(/^#/, '') || '/home').split('?')[0];
}
