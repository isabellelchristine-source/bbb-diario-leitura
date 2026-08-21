import { api } from '../api.js';
import { bookCoverHtml, progressHtml, starsHtml, escapeHtml, formatDate, timeAgo, toast, avatarHtml, letterHtml, commentsHtml, journalActionsHtml } from '../components.js';
import { state, STATUS_META } from '../state.js';
import { navigate } from '../router.js';
import {
  openUpdateProgressModal, openJournalModal, openReviewModal, openAddCoverModal, openEditDateModal, openEditBookModal,
  attachCommentHandlers, attachJournalActionHandlers, deleteReview,
} from '../actions.js';

function spoilerBlocked(entry, myPage, iAmReadingIt) {
  if (!iAmReadingIt) return false;
  return (entry.page || 0) > (myPage || 0);
}

export async function renderBook(view, bookId) {
  view.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">abrindo o livro... 📖</p>`;

  const { book } = await api.get(`/books/${bookId}`);
  const { user_books: myAll } = await api.get(`/user-books?user_id=${state.currentUser.id}`);
  const myUb = myAll.find((ub) => ub.book_id === bookId) || null;

  const friend = state.allUsers.find((u) => u.id !== state.currentUser.id);
  let friendUb = null;
  if (friend) {
    const { user_books: friendAll } = await api.get(`/user-books?user_id=${friend.id}`);
    friendUb = friendAll.find((ub) => ub.book_id === bookId) || null;
  }

  let myJournal = [];
  let friendJournal = [];
  if (myUb) myJournal = (await api.get(`/journal?user_book_id=${myUb.id}`)).entries;
  if (friendUb) friendJournal = (await api.get(`/journal?user_book_id=${friendUb.id}`)).entries;

  const bothReadingSame = myUb && friendUb && myUb.status === 'lendo' && friendUb.status === 'lendo';

  function readerBlock(ub, user, isMine) {
    if (!ub) {
      return `<p class="muted">${isMine ? 'Você ainda não tem esse livro na sua estante.' : `${escapeHtml(user.name)} ainda não tem esse livro na estante.`}</p>`;
    }
    const total = book.total_pages || 0;
    return `
      <div class="together-row" style="align-items:flex-start;flex-direction:column;gap:6px;width:100%">
        <div class="row-between" style="width:100%">
          <span class="together-name">${isMine ? 'Você' : escapeHtml(user.name)}</span>
          ${(() => { const m = STATUS_META[ub.status]; return `<span class="pill">${m.emoji} ${m.label}</span>`; })()}
        </div>
        ${ub.status === 'lendo' || ub.status === 'pausado' ? `
          <div style="width:100%">${progressHtml(ub.current_page, total)}</div>
          <p class="muted mt-0 mb-0">página ${ub.current_page} de ${total || '?'}</p>` : ''}
        ${ub.status === 'lido' && ub.rating ? starsHtml(ub.rating) : ''}
      </div>`;
  }

  view.innerHTML = `
    <button class="link-btn" id="back-btn">← voltar</button>
    <div class="book-detail-header">
      ${bookCoverHtml(book, 'lg')}
      <div>
        <h2 class="mt-0 mb-0">${escapeHtml(book.title)}</h2>
        <p class="muted">${escapeHtml(book.author || 'Autor desconhecido')}</p>
        <p class="muted">${book.total_pages ? `${book.total_pages} páginas` : 'sem total de páginas'}</p>
        <div class="chip-row">
          ${!book.cover_url ? `<button class="link-btn" id="add-cover">+ adicionar capa</button>` : ''}
          <button class="link-btn" id="edit-book-info">✏️ editar informações</button>
        </div>
      </div>
    </div>

    ${!myUb ? `<button class="btn btn-primary btn-block" id="add-to-shelf">+ Adicionar à minha estante</button>` : ''}

    ${bothReadingSame ? `
      <div class="card together-card">
        <div class="section-title mt-0">📖 Leitura em conjunto</div>
        ${readerBlock(myUb, state.currentUser, true)}
        <hr class="divider"/>
        ${readerBlock(friendUb, friend, false)}
      </div>` : `
      ${myUb ? `<div class="card">${readerBlock(myUb, state.currentUser, true)}</div>` : ''}
      ${friendUb ? `<div class="card">${readerBlock(friendUb, friend, false)}</div>` : ''}
    `}

    ${myUb ? `
      <div class="modal-actions" style="margin: 10px 0 4px">
        ${myUb.status === 'lendo' ? `<button class="btn btn-soft btn-sm" id="update-progress">Atualizar progresso</button>` : ''}
        ${myUb.status === 'lendo' ? `<button class="btn btn-soft btn-sm" id="add-journal">💭 O que você acha?</button>` : ''}
        ${myUb.status === 'lido' ? `<button class="btn btn-soft btn-sm" id="add-review">💌 ${myUb.review_text ? 'Editar' : 'Escrever'} carta</button>` : ''}
      </div>
      <div class="card">
        <div class="row-between">
          <span class="muted">Status</span>
          <select id="status-select">
            ${Object.entries(STATUS_META).map(([k, m]) => `<option value="${k}" ${k === myUb.status ? 'selected' : ''}>${m.emoji} ${m.label}</option>`).join('')}
          </select>
        </div>
        <hr class="divider"/>
        <div class="row-between"><span class="muted">Início</span><button class="link-btn" data-edit-date="start_date">${formatDate(myUb.start_date)} ✏️</button></div>
        <div class="row-between"><span class="muted">Término</span><button class="link-btn" data-edit-date="finish_date">${formatDate(myUb.finish_date, myUb.finish_date_precision)} ✏️</button></div>
        ${myUb.finish_date_precision === 'year' ? `<p class="muted mt-0" style="font-size:0.75rem">Essa data veio do histórico antigo — só sabemos o ano certo. Toque no ✏️ pra colocar o dia exato, se quiser.</p>` : ''}
        ${myUb.status === 'lido' ? `
          <hr class="divider"/>
          <div class="row-between mb-0"><span class="muted">Sua nota</span>${starsHtml(myUb.rating)}</div>
          ${myUb.favorite ? `<p class="fav-star mt-0">⭐ Favorito</p>` : ''}
        ` : ''}
        <hr class="divider"/>
        <button class="link-btn" id="remove-book" style="color:#D97878">Remover da estante</button>
      </div>
      ${myUb.status === 'lido' && myUb.review_text ? `
        <div class="row-between">
          <div class="section-title mb-0">💌 Sua carta <span class="letter-visibility-badge ${myUb.review_public ? 'pill sage' : 'pill'}">${myUb.review_public ? '🌍 pública' : '🔒 privada'}</span></div>
          <button class="link-btn" id="delete-review" style="color:#D97878;font-size:0.8rem">🗑️ Excluir</button>
        </div>
        ${letterHtml(myUb, state.currentUser.name, friend ? friend.name : 'você')}
      ` : ''}
    ` : ''}

    ${friendUb && friendUb.status === 'lido' ? `
      <div class="section-title">💌 Carta de ${escapeHtml(friend.name)}</div>
      ${letterHtml(friendUb, friend.name, state.currentUser.name) || `<p class="muted">${escapeHtml(friend.name)} ainda não escreveu a carta desse livro.</p>`}
    ` : ''}

    ${myUb ? `
    <div class="section-title">💭 Seu diário desse livro</div>
    <div class="card">
      ${myJournal.length ? myJournal.map((e) => `
        <div class="journal-entry">
          <div class="journal-bubble">
            <div class="journal-meta"><span class="journal-page-badge">pág. ${e.page}</span> · ${timeAgo(e.created_at)}${journalActionsHtml(e, state.currentUser.id)}</div>
            <div class="journal-text">${e.emoji ? e.emoji + ' ' : ''}${escapeHtml(e.text)}</div>
            ${commentsHtml(e, state.currentUser.id)}
          </div>
        </div>`).join('') : `<p class="muted mt-0 mb-0">Nenhuma anotação ainda.</p>`}
    </div>` : ''}

    ${friendUb && friendJournal.length ? `
    <div class="section-title">👀 O que ${escapeHtml(friend.name)} está achando</div>
    <div class="card">
      ${friendJournal.map((e) => {
        const blocked = spoilerBlocked(e, myUb?.current_page, myUb && myUb.status !== 'lido');
        if (blocked) {
          return `<div class="journal-entry"><div class="journal-bubble">
            <div class="spoiler-lock"><span>🔒 Anotação na página ${e.page} — pode conter spoiler para você</span>
            <button class="btn btn-sm btn-soft" data-reveal-friend="${e.id}">Ver mesmo assim</button></div></div></div>`;
        }
        return `<div class="journal-entry"><div class="journal-bubble">
          <div class="journal-meta"><span class="journal-page-badge">pág. ${e.page}</span> · ${timeAgo(e.created_at)}</div>
          <div class="journal-text">${e.emoji ? e.emoji + ' ' : ''}${escapeHtml(e.text)}</div>
          ${commentsHtml(e, state.currentUser.id)}
        </div></div>`;
      }).join('')}
    </div>` : ''}
  `;

  view.querySelector('#back-btn').onclick = () => window.history.back();

  const addCoverBtn = view.querySelector('#add-cover');
  if (addCoverBtn) addCoverBtn.onclick = () => openAddCoverModal(book, () => renderBook(view, bookId));

  const editBookBtn = view.querySelector('#edit-book-info');
  if (editBookBtn) editBookBtn.onclick = () => openEditBookModal(book, () => renderBook(view, bookId));

  const addBtn = view.querySelector('#add-to-shelf');
  if (addBtn) addBtn.onclick = async () => {
    try {
      const { user_book } = await api.post('/user-books', { book: { id: book.id }, status: 'quero_ler' });
      toast('Adicionado à sua estante!');
      renderBook(view, bookId);
    } catch (e) { toast(e.message); }
  };

  const updateBtn = view.querySelector('#update-progress');
  if (updateBtn) updateBtn.onclick = () => openUpdateProgressModal(myUb, () => renderBook(view, bookId));

  const journalBtn = view.querySelector('#add-journal');
  if (journalBtn) journalBtn.onclick = () => openJournalModal(myUb, () => renderBook(view, bookId));

  const reviewBtn = view.querySelector('#add-review');
  if (reviewBtn) reviewBtn.onclick = () => openReviewModal(myUb, () => renderBook(view, bookId));

  view.querySelectorAll('[data-edit-date]').forEach((btn) => {
    btn.onclick = () => {
      const field = btn.dataset.editDate;
      const label = field === 'start_date' ? 'Data de início' : 'Data de término';
      openEditDateModal(myUb, field, label, () => renderBook(view, bookId));
    };
  });

  const statusSelect = view.querySelector('#status-select');
  if (statusSelect) statusSelect.onchange = async () => {
    try {
      const { user_book } = await api.patch(`/user-books/${myUb.id}`, { status: statusSelect.value });
      toast('Status atualizado!');
      renderBook(view, bookId);
    } catch (e) { toast(e.message); }
  };

  const removeBtn = view.querySelector('#remove-book');
  if (removeBtn) removeBtn.onclick = async () => {
    if (!confirm('Remover este livro da sua estante?')) return;
    try {
      await api.del(`/user-books/${myUb.id}`);
      toast('Livro removido.');
      navigate('/shelf');
    } catch (e) { toast(e.message); }
  };

  view.querySelectorAll('[data-reveal-friend]').forEach((btn) => {
    btn.onclick = () => {
      const entry = friendJournal.find((e) => e.id === btn.dataset.revealFriend);
      const wrap = btn.closest('.journal-entry');
      wrap.outerHTML = `<div class="journal-entry"><div class="journal-bubble">
          <div class="journal-meta"><span class="journal-page-badge">pág. ${entry.page}</span> · ${timeAgo(entry.created_at)}</div>
          <div class="journal-text">${entry.emoji ? entry.emoji + ' ' : ''}${escapeHtml(entry.text)}</div>
          ${commentsHtml(entry, state.currentUser.id)}
        </div></div>`;
      attachCommentHandlers(view, () => renderBook(view, bookId));
    };
  });

  const deleteReviewBtn = view.querySelector('#delete-review');
  if (deleteReviewBtn) deleteReviewBtn.onclick = () => deleteReview(myUb, () => renderBook(view, bookId));

  attachCommentHandlers(view, () => renderBook(view, bookId));
  attachJournalActionHandlers(view, myJournal, () => renderBook(view, bookId));
}
