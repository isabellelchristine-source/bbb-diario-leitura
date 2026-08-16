import { bootstrapSession, loadAllUsers, state, clearSession } from './state.js';
import { renderLogin } from './views/login.js';
import { addRoute, startRouter, navigate, currentPath, resetRoutes } from './router.js';
import { renderHome } from './views/home.js';
import { renderShelf } from './views/shelf.js';
import { renderProfile } from './views/profile.js';
import { renderBook } from './views/book.js';
import { renderStats } from './views/stats.js';
import { api } from './api.js';
import { toast } from './components.js';

const appEl = document.getElementById('app');
let navListenerBound = false;

async function boot() {
  const user = await bootstrapSession();
  if (!user) {
    renderLoginScreen();
    return;
  }
  await loadAllUsers();
  renderShell();
}

function renderLoginScreen() {
  appEl.innerHTML = '';
  renderLogin(appEl, async () => {
    renderShell();
  });
}

function friendUsername() {
  const f = state.allUsers.find((u) => u.username !== state.currentUser.username);
  return f ? f.username : null;
}

function friendFirstName() {
  const f = state.allUsers.find((u) => u.username !== state.currentUser.username);
  return f ? f.name.trim().split(/\s+/)[0] : 'Amiga';
}

function renderShell() {
  appEl.innerHTML = `
    <div class="app-shell">
      <div class="topbar">
        <div class="brand">📖 BBB<span class="dot">.</span></div>
        <button class="icon-btn" id="logout-btn" title="Sair">⏻</button>
      </div>
      <div class="main-content" id="view"></div>
      <nav class="bottom-nav">
        <button class="nav-item" data-path="/home"><span class="icon">🏠</span>Home</button>
        <button class="nav-item" data-path="/shelf"><span class="icon">📚</span>Estante</button>
        <button class="nav-item" data-path="/friend"><span class="icon">👭<span class="nav-badge" id="friend-badge" hidden></span></span>${friendFirstName()}</button>
        <button class="nav-item" data-path="/stats"><span class="icon">📊</span>Estatísticas</button>
        <button class="nav-item" data-path="/me"><span class="icon">👤</span>Perfil</button>
      </nav>
    </div>
  `;
  document.getElementById('logout-btn').onclick = async () => {
    try { await api.post('/auth/logout'); } catch (e) { /* noop */ }
    clearSession();
    navigate('/home');
    renderLoginScreen();
  };

  const view = document.getElementById('view');

  resetRoutes();
  addRoute('/home', async () => renderHome(view));
  addRoute('/shelf', async (_, query) => renderShelf(view, query.get('status')));
  addRoute('/friend', async () => {
    const fu = friendUsername();
    if (!fu) {
      view.innerHTML = `<div class="empty-state"><div class="emoji">👭</div><p>Ainda não há uma amiga cadastrada.<br/>Peça para ela criar o perfil dela na tela de login.</p></div>`;
      return;
    }
    // se tem uma novidade específica (ex: um comentário num livro), vai direto pra lá
    if (latestActivity && latestActivity.bookId) {
      const bookId = latestActivity.bookId;
      markSeenAndHideBadge();
      navigate(`/book/${bookId}`);
      return;
    }
    navigate(`/user/${fu}`);
  });
  addRoute('/me', async () => navigate(`/user/${state.currentUser.username}`));
  addRoute('/user/:username', async (params) => {
    await renderProfile(view, params.username);
    if (params.username === friendUsername()) markSeenAndHideBadge();
  });
  addRoute('/book/:bookId', async (params) => renderBook(view, params.bookId));
  addRoute('/stats', async () => renderStats(view));

  function updateActiveNav() {
    const path = currentPath();
    const own = state.currentUser.username;
    const fu = friendUsername();
    let effective = path;
    if (path === `/user/${own}`) effective = '/me';
    else if (fu && path === `/user/${fu}`) effective = '/friend';
    else if (path.startsWith('/book/')) effective = '/shelf';
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.path === effective);
    });
  }

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.path);
  });

  if (!navListenerBound) {
    window.addEventListener('hashchange', updateActiveNav);
    navListenerBound = true;
  }
  startRouter();
  updateActiveNav();
  setTimeout(updateActiveNav, 60);

  checkActivity();
  if (activityTimer) clearInterval(activityTimer);
  activityTimer = setInterval(checkActivity, 60000);
}

let activityTimer = null;
let latestActivity = null;
let notifiedAt = null; // evita repetir o mesmo toast a cada checagem

async function checkActivity() {
  try {
    const { hasNew, latest } = await api.get('/activity/unseen');
    latestActivity = latest;
    const badge = document.getElementById('friend-badge');
    if (badge) badge.hidden = !hasNew;
    const navLabel = document.querySelector('.nav-item[data-path="/friend"]');
    if (navLabel) navLabel.title = hasNew && latest ? latest.message : '';
    if (hasNew && latest && latest.at !== notifiedAt) {
      notifiedAt = latest.at;
      toast(`💬 ${latest.message}`);
    }
  } catch (e) { /* silencioso — não é crítico */ }
}

async function markSeenAndHideBadge() {
  try { await api.post('/users/me/seen'); } catch (e) { /* noop */ }
  latestActivity = null;
  const badge = document.getElementById('friend-badge');
  if (badge) badge.hidden = true;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

boot();
