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
      currentCleanup = await route.handler(params, query);
      window.scrollTo(0, 0);
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
