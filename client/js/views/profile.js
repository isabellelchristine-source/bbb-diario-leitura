import { api } from '../api.js';
import { avatarHtml, bookCoverHtml, progressHtml, starsHtml, escapeHtml, timeAgo, formatDate } from '../components.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { openEditProfileModal } from '../actions.js';

export async function renderProfile(view, username) {
  view.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">abrindo perfil... 👤</p>`;

  const isOwn = username === state.currentUser.username;
  const { user, stats, currently_reading } = await api.get(`/users/${encodeURIComponent(username)}`);
  const { entries: journal } = await api.get(`/journal?user_id=${user.id}&limit=8`);
  const { user_books: finished } = await api.get(`/user-books?user_id=${user.id}&status=lido`);
  const reviewed = finished.filter((f) => f.review_text || f.review_hidden).slice(0, 5);

  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="display:flex;justify-content:center;margin-bottom:10px">${avatarHtml(user, 84)}</div>
      <h2 class="mt-0 mb-0">${escapeHtml(user.name)}</h2>
      <p class="muted">@${escapeHtml(user.username)}</p>
      ${user.bio ? `<p>${escapeHtml(user.bio)}</p>` : ''}
      ${isOwn ? `<button class="btn btn-soft btn-sm" id="edit-profile">Editar perfil</button>` : ''}
    </div>

    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat-box"><div class="num">${stats.total_read}</div><div class="label">Lidos</div></div>
      <div class="stat-box"><div class="num">${stats.total_reading}</div><div class="label">Lendo</div></div>
      <div class="stat-box"><div class="num">${stats.total_want}</div><div class="label">Quero ler</div></div>
      <div class="stat-box"><div class="num">${stats.avg_rating ? stats.avg_rating.toFixed(1) : '—'}</div><div class="label">Nota média</div></div>
    </div>

    <div class="section-title">📖 Lendo agora</div>
    <div class="card">
      ${currently_reading.length ? currently_reading.map((ub) => `
        <div class="book-row" data-book="${ub.book_id}" style="cursor:pointer;margin-bottom:12px">
          ${bookCoverHtml(ub.book)}
          <div style="flex:1">
            <div class="book-title">${escapeHtml(ub.book?.title || '')}</div>
            <div class="book-author">${escapeHtml(ub.book?.author || '')}</div>
            <div style="margin-top:6px">${progressHtml(ub.current_page, ub.book?.total_pages || 0)}</div>
            <p class="muted mt-0 mb-0">página ${ub.current_page} de ${ub.book?.total_pages || '?'}</p>
          </div>
        </div>`).join('') : `<p class="muted mt-0 mb-0">Nenhum livro em andamento no momento.</p>`}
    </div>

    <div class="section-title">💭 ${isOwn ? 'Suas últimas atualizações' : `O que ${escapeHtml(user.name)} está achando`}</div>
    <div class="card">
      ${journal.length ? journal.map((e) => `
        <div class="journal-entry">
          <div class="journal-bubble">
            <div class="journal-meta">${e.book ? `<strong>${escapeHtml(e.book.title)}</strong> · ` : ''}${timeAgo(e.created_at)} <span class="journal-page-badge">pág. ${e.page}</span></div>
            <div class="journal-text">${e.emoji ? e.emoji + ' ' : ''}${escapeHtml(e.text)}</div>
          </div>
        </div>`).join('') : `<p class="muted mt-0 mb-0">Nenhuma anotação por aqui ainda.</p>`}
    </div>

    <div class="section-title">💌 Últimas cartas</div>
    <div class="card">
      ${reviewed.length ? reviewed.map((ub) => `
        <div class="book-row" data-book="${ub.book_id}" style="cursor:pointer;margin-bottom:12px">
          ${bookCoverHtml(ub.book)}
          <div>
            <div class="book-title">${escapeHtml(ub.book?.title || '')} ${ub.favorite ? '⭐' : ''}</div>
            ${starsHtml(ub.rating)}
            ${ub.review_hidden
              ? `<p class="muted" style="margin:4px 0 0">🔒 carta privada</p>`
              : `<p class="muted" style="margin:4px 0 0">${escapeHtml((ub.review_text || '').slice(0, 120))}${(ub.review_text || '').length > 120 ? '…' : ''}</p>`}
          </div>
        </div>`).join('') : `<p class="muted mt-0 mb-0">Nenhuma carta ainda.</p>`}
    </div>

    <div class="section-title">✅ Histórico</div>
    <div class="card">
      ${finished.length ? `<div class="shelf-grid">${finished.slice(0, 12).map((ub) => `
        <div class="shelf-item" data-book="${ub.book_id}">
          ${bookCoverHtml(ub.book)}
          <div class="book-title">${escapeHtml(ub.book?.title || '')}</div>
          <div class="muted" style="font-size:0.7rem">${formatDate(ub.finish_date, ub.finish_date_precision)}</div>
        </div>`).join('')}</div>` : `<p class="muted mt-0 mb-0">Ainda não terminou nenhum livro.</p>`}
    </div>
  `;

  const editBtn = view.querySelector('#edit-profile');
  if (editBtn) editBtn.onclick = () => openEditProfileModal(() => renderProfile(view, state.currentUser.username));

  view.querySelectorAll('[data-book]').forEach((el) => {
    el.onclick = () => navigate(`/book/${el.dataset.book}`);
  });
}
