import { api } from '../api.js';
import { shelfCoverHtml, escapeHtml, starsHtml, formatDate } from '../components.js';
import { state, STATUS_META } from '../state.js';
import { navigate, getRenderToken } from '../router.js';
import { openAddBookModal } from '../actions.js';

let currentTab = 'lendo';
let currentSort = 'recentes';
let searchQuery = '';

// Normaliza pra busca ignorar acento e maiúscula/minúscula ("Jose" acha "José").
function normalize(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function bookRowHtml(ub) {
  return `
    <div class="shelf-item" data-book="${ub.book_id}">
      ${shelfCoverHtml(ub.book)}
      <div class="book-title">${escapeHtml(ub.book?.title || '')}</div>
      <div class="book-author">${escapeHtml(ub.book?.author || '')}</div>
      ${currentTab === 'lido' && ub.rating ? starsHtml(ub.rating) : ''}
      ${currentTab === 'lido' ? `<div class="muted" style="font-size:0.7rem">${formatDate(ub.finish_date, ub.finish_date_precision)}</div>` : ''}
      ${currentTab === 'lendo' ? `<div class="muted" style="font-size:0.72rem">pág. ${ub.current_page}/${ub.book?.total_pages || '?'}</div>` : ''}
    </div>`;
}

export async function renderShelf(view, statusFromQuery) {
  const myToken = getRenderToken();
  if (statusFromQuery) currentTab = statusFromQuery;

  view.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">abrindo sua estante... 📚</p>`;

  const { user_books } = await api.get(`/user-books?user_id=${state.currentUser.id}&status=${currentTab}`);
  if (getRenderToken() !== myToken) return;

  let sorted = [...user_books];
  if (currentTab === 'lido') {
    if (currentSort === 'nota') sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (currentSort === 'az') sorted.sort((a, b) => (a.book?.title || '').localeCompare(b.book?.title || ''));
    else sorted.sort((a, b) => new Date(b.finish_date || b.updated_at) - new Date(a.finish_date || a.updated_at));
  }

  view.innerHTML = `
    <div class="row-between" style="margin-bottom:6px">
      <h2 class="mt-0 mb-0">📚 Minha estante</h2>
      <button class="btn btn-primary btn-sm" id="add-book">+ Adicionar</button>
    </div>
    <div class="tabs">
      ${Object.entries(STATUS_META).map(([k, m]) => `<button class="tab${k === currentTab ? ' active' : ''}" data-tab="${k}">${m.emoji} ${m.label}</button>`).join('')}
    </div>
    ${currentTab === 'lido' ? `
      <div class="tabs" style="margin-bottom:14px">
        <button class="tab${currentSort === 'recentes' ? ' active' : ''}" data-sort="recentes">Mais recentes</button>
        <button class="tab${currentSort === 'nota' ? ' active' : ''}" data-sort="nota">Nota</button>
        <button class="tab${currentSort === 'az' ? ' active' : ''}" data-sort="az">A-Z</button>
      </div>` : ''}

    ${sorted.length ? `
      <div class="field" style="position:relative;margin-bottom:10px">
        <input id="shelf-search" placeholder="🔍 Buscar por título ou autor..." value="${escapeHtml(searchQuery)}" />
      </div>
      <div id="shelf-grid-wrap"></div>
    ` : `
      <div class="empty-state">
        <div class="emoji">${STATUS_META[currentTab].emoji}</div>
        <p>Nenhum livro em "${STATUS_META[currentTab].label}" ainda.</p>
      </div>`}
  `;

  const gridWrap = view.querySelector('#shelf-grid-wrap');

  function paintGrid() {
    if (!gridWrap) return;
    const q = normalize(searchQuery);
    const filtered = q
      ? sorted.filter((ub) => normalize(ub.book?.title).includes(q) || normalize(ub.book?.author).includes(q))
      : sorted;
    gridWrap.innerHTML = filtered.length
      ? `<div class="shelf-grid">${filtered.map(bookRowHtml).join('')}</div>`
      : `<div class="empty-state"><div class="emoji">🔍</div><p>Nenhum livro encontrado pra "${escapeHtml(searchQuery)}".</p></div>`;
    gridWrap.querySelectorAll('[data-book]').forEach((el) => {
      el.onclick = () => navigate(`/book/${el.dataset.book}`);
    });
  }
  paintGrid();

  const searchInput = view.querySelector('#shelf-search');
  if (searchInput) {
    searchInput.oninput = () => { searchQuery = searchInput.value; paintGrid(); };
  }

  view.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = () => { currentTab = btn.dataset.tab; searchQuery = ''; renderShelf(view); };
  });
  view.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.onclick = () => { currentSort = btn.dataset.sort; renderShelf(view); };
  });
  view.querySelector('#add-book').onclick = () => {
    openAddBookModal(() => renderShelf(view));
  };
}
