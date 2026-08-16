import { api } from '../api.js';
import { escapeHtml, bookCoverHtml, starsHtml } from '../components.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { openGoalModal } from '../actions.js';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function renderStats(view) {
  view.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">calculando suas estatísticas... 📊</p>`;

  const year = new Date().getFullYear();
  const [{ stats }, { user_books: finished }, { goal }] = await Promise.all([
    api.get(`/stats/${state.currentUser.id}`),
    api.get(`/user-books?user_id=${state.currentUser.id}&status=lido`),
    api.get(`/goals?user_id=${state.currentUser.id}&year=${year}`),
  ]);

  const friend = state.allUsers.find((u) => u.id !== state.currentUser.id);
  let friendStats = null;
  if (friend) friendStats = (await api.get(`/stats/${friend.id}`)).stats;

  const monthCounts = new Array(12).fill(0);
  finished.forEach((ub) => {
    if (ub.finish_date) {
      const d = new Date(ub.finish_date);
      if (d.getFullYear() === year) monthCounts[d.getMonth()]++;
    }
  });
  const maxMonth = Math.max(1, ...monthCounts);

  const goalTarget = goal?.target_books || 0;
  const goalProgress = stats.books_read_this_year;
  const goalPct = goalTarget ? Math.min(100, Math.round((goalProgress / goalTarget) * 100)) : 0;

  view.innerHTML = `
    <h2 class="mt-0">📊 Estatísticas</h2>

    <div class="stat-grid">
      <div class="stat-box"><div class="num">${stats.total_read}</div><div class="label">Livros lidos</div></div>
      <div class="stat-box"><div class="num">${stats.total_pages_read}</div><div class="label">Páginas lidas</div></div>
      <div class="stat-box"><div class="num">${stats.avg_rating ? stats.avg_rating.toFixed(1) + ' ★' : '—'}</div><div class="label">Nota média</div></div>
      <div class="stat-box"><div class="num">${stats.total_abandoned}</div><div class="label">Abandonados</div></div>
      <div class="stat-box"><div class="num">${stats.books_read_this_year}</div><div class="label">Lidos em ${year}</div></div>
      <div class="stat-box"><div class="num">${stats.pages_read_this_year}</div><div class="label">Páginas em ${year}</div></div>
    </div>

    <div class="section-title">🎯 Meta de leitura ${year}</div>
    <div class="card">
      ${goalTarget ? `
        ${progressBar(goalPct)}
        <div class="row-between" style="margin-top:8px">
          <span class="muted">${goalProgress}/${goalTarget} livros</span>
          <span class="muted">${goalTarget - goalProgress > 0 ? `faltam ${goalTarget - goalProgress}` : 'meta atingida! 🎉'}</span>
        </div>
      ` : `<p class="muted mt-0">Você ainda não definiu uma meta para este ano.</p>`}
      <button class="btn btn-soft btn-sm" id="edit-goal" style="margin-top:12px">${goalTarget ? 'Editar meta' : 'Definir meta'}</button>
    </div>

    <div class="section-title">📈 Livros lidos por mês (${year})</div>
    <div class="card">
      <div class="bar-chart">
        ${monthCounts.map((c, i) => `
          <div class="bar-wrap">
            <div class="bar" style="height:${Math.max(4, (c / maxMonth) * 90)}px" title="${c} livro(s)"></div>
            <div class="bar-label">${MONTHS[i]}</div>
          </div>`).join('')}
      </div>
    </div>

    ${stats.best_book || stats.worst_book ? `
    <div class="section-title">🏆 Destaques</div>
    <div class="card">
      ${stats.best_book ? `
        <div class="book-row" data-book="${stats.best_book.book_id}" style="cursor:pointer;margin-bottom:12px">
          ${bookCoverHtml(stats.best_book.book)}
          <div><div class="muted">Melhor avaliado</div><div class="book-title">${escapeHtml(stats.best_book.book?.title || '')}</div>${starsHtml(stats.best_book.rating)}</div>
        </div>` : ''}
      ${stats.worst_book && stats.worst_book.id !== stats.best_book?.id ? `
        <div class="book-row" data-book="${stats.worst_book.book_id}" style="cursor:pointer">
          ${bookCoverHtml(stats.worst_book.book)}
          <div><div class="muted">Menos bem avaliado</div><div class="book-title">${escapeHtml(stats.worst_book.book?.title || '')}</div>${starsHtml(stats.worst_book.rating)}</div>
        </div>` : ''}
    </div>` : ''}

    ${friend && friendStats ? `
    <div class="section-title">👭 Comparativo entre vocês</div>
    <div class="card">
      <p class="mt-0">📚 ${escapeHtml(state.currentUser.name)} leu <strong>${stats.books_read_this_year}</strong> livro(s) este ano</p>
      <p>📚 ${escapeHtml(friend.name)} leu <strong>${friendStats.books_read_this_year}</strong> livro(s) este ano</p>
      <p class="muted mb-0">Cada uma no seu ritmo — o importante é continuar lendo juntas! 🤍</p>
    </div>` : ''}
  `;

  view.querySelector('#edit-goal').onclick = () => openGoalModal(goalTarget, () => renderStats(view));
  view.querySelectorAll('[data-book]').forEach((el) => {
    el.onclick = () => navigate(`/book/${el.dataset.book}`);
  });
}

function progressBar(pct) {
  return `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}
