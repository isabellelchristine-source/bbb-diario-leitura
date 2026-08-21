import { api } from '../api.js';
import { avatarHtml, bookCoverHtml, shelfCoverHtml, progressHtml, timeAgo, escapeHtml, toast, commentsHtml, journalActionsHtml } from '../components.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { openUpdateProgressModal, openJournalModal, attachCommentHandlers, attachJournalActionHandlers } from '../actions.js';

function spoilerBlocked(entry, myBookMap) {
  if (entry.user_id === state.currentUser.id) return false;
  if (!entry.book) return false;
  const mine = myBookMap[entry.book.id];
  if (!mine) return false; // não estou lendo/planejando esse livro, sem risco de spoiler percebido
  if (mine.status === 'lido') return false;
  const myPage = mine.current_page || 0;
  return (entry.page || 0) > myPage;
}

function journalEntryHtml(entry, myBookMap, revealed) {
  const isMine = entry.user_id === state.currentUser.id;
  const user = isMine ? state.currentUser : state.allUsers.find((u) => u.id === entry.user_id);
  const blocked = !revealed && spoilerBlocked(entry, myBookMap);
  const reactionCounts = {};
  (entry.reactions || []).forEach((r) => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1; });

  if (blocked) {
    return `
      <div class="journal-entry" data-entry="${entry.id}">
        ${avatarHtml(user, 40)}
        <div class="journal-bubble">
          <div class="journal-meta"><strong>${escapeHtml(user?.name || '')}</strong> · ${timeAgo(entry.created_at)}</div>
          <div class="spoiler-lock">
            <span>🔒 Atualização na página ${entry.page} — pode ser spoiler para você</span>
            <button class="btn btn-sm btn-soft" data-reveal="${entry.id}">Ver mesmo assim</button>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="journal-entry" data-entry="${entry.id}">
      ${avatarHtml(user, 40)}
      <div class="journal-bubble">
        <div class="journal-meta" data-open-book="${entry.book_id || entry.book?.id || ''}" style="cursor:pointer">
          <strong>${escapeHtml(user?.name || '')}</strong>
          ${entry.book ? `· <span class="muted">${escapeHtml(entry.book.title)}</span>` : ''}
          · ${timeAgo(entry.created_at)}
          <span class="journal-page-badge">pág. ${entry.page || 0}</span>
          ${isMine ? journalActionsHtml(entry, state.currentUser.id) : ''}
        </div>
        <div class="journal-text" data-open-book="${entry.book_id || entry.book?.id || ''}" style="cursor:pointer">${entry.emoji ? entry.emoji + ' ' : ''}${escapeHtml(entry.text)}</div>
        <div class="reaction-row" data-reactions>
          ${Object.entries(reactionCounts).map(([emoji, count]) => {
            const mine = (entry.reactions || []).some((r) => r.emoji === emoji && r.user_id === state.currentUser.id);
            return `<button class="reaction-chip${mine ? ' mine' : ''}" data-react="${entry.id}" data-emoji="${emoji}">${emoji} ${count}</button>`;
          }).join('')}
          <button class="reaction-chip" data-add-reaction="${entry.id}">+ 🙂</button>
        </div>
        ${commentsHtml(entry, state.currentUser.id)}
      </div>
    </div>`;
}

export async function renderHome(view) {
  view.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">carregando seu feed... 📖</p>`;

  const [feed, myBooks] = await Promise.all([
    api.get('/feed'),
    api.get(`/user-books?user_id=${state.currentUser.id}`),
  ]);

  const myBookMap = {};
  myBooks.user_books.forEach((ub) => { myBookMap[ub.book_id] = ub; });

  const myReading = feed.reading.find((r) => r.user.id === state.currentUser.id);
  const friendReading = feed.reading.find((r) => r.user.id !== state.currentUser.id);

  function heroHtml(readingGroup, isMine) {
    if (!readingGroup || !readingGroup.books.length) {
      return `
        <div class="feed-hero${isMine ? '' : ' friend'}">
          <div class="who">${isMine ? 'Você' : escapeHtml(readingGroup ? readingGroup.user.name : 'sua amiga')}</div>
          <div class="book-title">Nenhum livro em andamento ${isMine ? '— que tal começar um? 📚' : 'no momento.'}</div>
        </div>`;
    }
    const ub = readingGroup.books[0];
    const total = ub.book?.total_pages || 0;
    return `
      <div class="feed-hero${isMine ? '' : ' friend'}" data-ub="${ub.id}">
        <div class="who">${isMine ? 'Você está lendo' : `${escapeHtml(readingGroup.user.name)} está lendo`} ${isMine ? '📖' : '👀'}</div>
        <div class="book-title">${escapeHtml(ub.book?.title || '')}</div>
        <p class="muted" style="color:rgba(255,255,255,0.85);margin:2px 0 10px">${escapeHtml(ub.book?.author || '')} · página ${ub.current_page} de ${total || '?'}</p>
        ${progressHtml(ub.current_page, total)}
        <p class="muted" style="color:rgba(255,255,255,0.75);margin-top:8px;font-size:0.76rem">atualizado ${timeAgo(ub.updated_at)}</p>
        ${isMine ? `
          <div class="modal-actions" style="margin-top:14px">
            <button class="btn btn-soft btn-sm" data-action="update-progress" data-ub="${ub.id}">Atualizar progresso</button>
            <button class="btn btn-soft btn-sm" data-action="journal" data-ub="${ub.id}">💭 O que você acha?</button>
          </div>` : `
          <div class="modal-actions" style="margin-top:14px">
            <button class="btn btn-soft btn-sm" data-action="view-book" data-book="${ub.book_id}">Ver detalhes</button>
          </div>`}
      </div>`;
  }

  const together = feed.reading.filter((r) => r.books.length).length >= 2
    && myReading && friendReading && myReading.books.length && friendReading.books.length
    && myReading.books[0].book_id === friendReading.books[0].book_id;

  view.innerHTML = `
    ${heroHtml(myReading, true)}
    ${heroHtml(friendReading, false)}

    ${together ? `
      <div class="card together-card">
        <div class="section-title mt-0">📖 Leitura em conjunto</div>
        <p class="muted mt-0">Vocês duas estão lendo <strong>${escapeHtml(myReading.books[0].book.title)}</strong> ao mesmo tempo!</p>
        <div class="together-row">
          <span class="together-name">${escapeHtml(state.currentUser.name)}</span>
          ${progressHtml(myReading.books[0].current_page, myReading.books[0].book.total_pages)}
        </div>
        <div class="together-row">
          <span class="together-name">${escapeHtml(friendReading.user.name)}</span>
          ${progressHtml(friendReading.books[0].current_page, friendReading.books[0].book.total_pages)}
        </div>
        <button class="btn btn-primary btn-sm" data-action="view-book" data-book="${myReading.books[0].book_id}">Ver leitura em conjunto</button>
      </div>` : ''}

    <div class="section-title">✅ Últimos livros finalizados</div>
    ${feed.recently_finished.length ? `
      <div class="finished-strip">
        ${feed.recently_finished.map((ub) => `
          <div class="finished-item" data-action="view-book" data-book="${ub.book_id}" title="${escapeHtml(ub.book?.title || '')}">
            ${shelfCoverHtml(ub.book)}
            <div class="finished-who">${avatarHtml(ub.user, 22)}</div>
            <div class="finished-title">${escapeHtml(ub.book?.title || '')}</div>
          </div>`).join('')}
      </div>` : `<div class="card"><p class="muted mt-0 mb-0">Ninguém terminou um livro ainda por aqui.</p></div>`}

    <div class="section-title">💭 Últimas atualizações</div>
    <p class="muted mt-0" style="margin-bottom:10px">Toque numa atualização pra abrir o livro dela, com todo o histórico e os comentários.</p>
    <div class="card" id="journal-feed">
      ${feed.recent_journal.length ? feed.recent_journal.slice(0, 5).map((e) => journalEntryHtml(e, myBookMap, false)).join('') : `<p class="muted mt-0 mb-0">Ainda não há anotações de leitura. Que tal escrever a primeira? 🤍</p>`}
    </div>
  `;

  view.querySelectorAll('[data-action="update-progress"]').forEach((btn) => {
    btn.onclick = () => {
      const ub = myReading.books.find((b) => b.id === btn.dataset.ub);
      openUpdateProgressModal(ub, () => renderHome(view));
    };
  });
  view.querySelectorAll('[data-action="journal"]').forEach((btn) => {
    btn.onclick = () => {
      const ub = myReading.books.find((b) => b.id === btn.dataset.ub);
      openJournalModal(ub, () => renderHome(view));
    };
  });
  view.querySelectorAll('[data-action="view-book"]').forEach((el) => {
    el.style.cursor = 'pointer';
    el.onclick = () => navigate(`/book/${el.dataset.book}`);
  });
  view.querySelectorAll('[data-reveal]').forEach((btn) => {
    btn.onclick = () => {
      const entry = feed.recent_journal.find((e) => e.id === btn.dataset.reveal);
      const wrap = btn.closest('.journal-entry');
      wrap.outerHTML = journalEntryHtml(entry, myBookMap, true);
      view.querySelectorAll('[data-open-book]').forEach((el) => {
        if (!el.dataset.openBook) return;
        el.onclick = () => navigate(`/book/${el.dataset.openBook}`);
      });
      attachReactionHandlers(view, feed);
      attachCommentHandlers(view, () => renderHome(view));
      attachJournalActionHandlers(view, feed.recent_journal, () => renderHome(view));
    };
  });
  view.querySelectorAll('[data-open-book]').forEach((el) => {
    if (!el.dataset.openBook) return;
    el.onclick = () => navigate(`/book/${el.dataset.openBook}`);
  });
  attachReactionHandlers(view, feed);
  attachCommentHandlers(view, () => renderHome(view));
  attachJournalActionHandlers(view, feed.recent_journal, () => renderHome(view));
}

function attachReactionHandlers(view, feed) {
  view.querySelectorAll('[data-react]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await api.post('/reactions', { journal_id: btn.dataset.react, emoji: btn.dataset.emoji });
        renderHome(view);
      } catch (e) { toast(e.message); }
    };
  });
  view.querySelectorAll('[data-add-reaction]').forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const row = btn.closest('[data-reactions]');
      if (row.querySelector('.reaction-picker')) { row.querySelector('.reaction-picker').remove(); return; }
      const picker = document.createElement('div');
      picker.className = 'reaction-picker';
      picker.innerHTML = ['❤️', '😂', '😭', '😱', '👀', '⭐'].map((e) => `<button data-emoji="${e}">${e}</button>`).join('');
      row.appendChild(picker);
      picker.querySelectorAll('button').forEach((b) => {
        b.onclick = async () => {
          try {
            await api.post('/reactions', { journal_id: btn.dataset.addReaction, emoji: b.dataset.emoji });
            renderHome(view);
          } catch (e) { toast(e.message); }
        };
      });
    };
  });
}
