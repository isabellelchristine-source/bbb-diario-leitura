// actions.js — fluxos reutilizáveis (modais) que mudam dados: progresso, diário, resenha, adicionar livro, metas, perfil.
import { api } from './api.js';
import { openModal, closeModal } from './modal.js';
import { toast, escapeHtml, starsHtml, bookCoverHtml, fileToResizedDataUrl } from './components.js';
import { EMOJIS, STATUS_META, state } from './state.js';

// Liga os campos de comentário (input + botão enviar) de qualquer lista de atualizações
// do diário renderizada com commentsHtml(). Chame de novo toda vez que re-renderizar a view.
export function attachCommentHandlers(view, onSent) {
  view.querySelectorAll('[data-comment-send]').forEach((btn) => {
    const send = async () => {
      const journalId = btn.dataset.commentSend;
      const input = view.querySelector(`[data-comment-input="${journalId}"]`);
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      try {
        await api.post('/comments', { journal_id: journalId, text });
        onSent && onSent();
      } catch (e) {
        toast(e.message);
        input.disabled = false;
      }
    };
    btn.onclick = send;
  });
  view.querySelectorAll('[data-comment-input]').forEach((input) => {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        view.querySelector(`[data-comment-send="${input.dataset.commentInput}"]`)?.click();
      }
    };
  });
}

export function openUpdateProgressModal(userBook, onDone) {
  const total = userBook.book?.total_pages || 0;
  openModal(`
    <h3>📖 Atualizar progresso</h3>
    <p class="muted mt-0">${escapeHtml(userBook.book?.title || '')}</p>
    <div class="field">
      <label>Página atual (de ${total || '—'})</label>
      <input type="number" id="f-page" min="0" max="${total || 100000}" value="${userBook.current_page || 0}" autofocus />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Salvar</button>
    </div>
  `, {
    onMount: (modal) => {
      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelector('#f-save').onclick = async () => {
        const page = Number(modal.querySelector('#f-page').value || 0);
        const body = { current_page: page };
        if (total && page >= total) body.status = 'lido';
        try {
          const { user_book } = await api.patch(`/user-books/${userBook.id}`, body);
          closeModal();
          toast(body.status === 'lido' ? '🎉 Livro concluído!' : 'Progresso atualizado!');
          onDone && onDone(user_book);
        } catch (e) { toast(e.message); }
      };
    },
  });
}

export function openEditDateModal(userBook, field, label, onDone) {
  const current = userBook[field];
  const asInputValue = current ? new Date(current).toISOString().slice(0, 10) : '';
  openModal(`
    <h3>📅 ${label}</h3>
    <p class="muted mt-0">${escapeHtml(userBook.book?.title || '')}</p>
    <div class="field">
      <label>${label}</label>
      <input type="date" id="f-date" value="${asInputValue}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      ${current ? `<button class="btn btn-danger" id="f-clear">Limpar data</button>` : ''}
      <button class="btn btn-primary btn-block" id="f-save">Salvar</button>
    </div>
  `, {
    onMount: (modal) => {
      modal.querySelector('#f-cancel').onclick = closeModal;
      const clearBtn = modal.querySelector('#f-clear');
      if (clearBtn) clearBtn.onclick = async () => {
        try {
          const { user_book } = await api.patch(`/user-books/${userBook.id}`, { [field]: null });
          closeModal();
          toast('Data removida.');
          onDone && onDone(user_book);
        } catch (e) { toast(e.message); }
      };
      modal.querySelector('#f-save').onclick = async () => {
        const val = modal.querySelector('#f-date').value;
        if (!val) return toast('Escolha uma data ou clique em "Limpar data"');
        try {
          const { user_book } = await api.patch(`/user-books/${userBook.id}`, { [field]: `${val}T12:00:00.000Z` });
          closeModal();
          toast('Data atualizada!');
          onDone && onDone(user_book);
        } catch (e) { toast(e.message); }
      };
    },
  });
}

export function openJournalModal(userBook, onDone) {
  const draft = loadDraft(userBook, 'journal');
  let selectedEmoji = draft?.emoji || '';
  openModal(`
    <h3>💭 O que você está achando?</h3>
    <p class="muted mt-0">${escapeHtml(userBook.book?.title || '')} — página ${userBook.current_page || 0}</p>
    ${draft ? `<p class="muted" style="background:var(--line);padding:8px 12px;border-radius:10px">📝 Recuperamos um rascunho não salvo de antes.</p>` : ''}
    <div class="field">
      <label>Sua anotação</label>
      <textarea id="f-text" placeholder="Meu Deus, esse personagem me irrita MUITO 😭">${escapeHtml(draft?.text || '')}</textarea>
    </div>
    <div class="field">
      <label>Emoji (opcional)</label>
      <div class="emoji-picker-row" id="f-emojis">
        ${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === selectedEmoji ? 'selected' : ''}">${e}</button>`).join('')}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Publicar</button>
    </div>
  `, {
    onMount: (modal) => {
      const textEl = modal.querySelector('#f-text');
      const persistDraft = () => saveDraft(userBook, { text: textEl.value, emoji: selectedEmoji }, 'journal');
      textEl.addEventListener('input', persistDraft);

      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelectorAll('#f-emojis button').forEach((btn) => {
        btn.onclick = () => {
          const already = btn.classList.contains('selected');
          modal.querySelectorAll('#f-emojis button').forEach((b) => b.classList.remove('selected'));
          selectedEmoji = already ? '' : btn.dataset.emoji;
          if (!already) btn.classList.add('selected');
          persistDraft();
        };
      });
      modal.querySelector('#f-save').onclick = async () => {
        const text = textEl.value.trim();
        if (!text) return toast('Escreva algo antes de publicar 🤍');
        try {
          const { entry } = await api.post('/journal', {
            user_book_id: userBook.id, text, emoji: selectedEmoji, page: userBook.current_page || 0,
          });
          clearDraft(userBook, 'journal');
          closeModal();
          toast('Anotação publicada!');
          onDone && onDone(entry);
        } catch (e) { toast(e.message); }
      };
    },
  });
}

function draftKey(userBook, kind = 'review') {
  return `bbb_draft_${kind}_${userBook.id}`;
}

function saveDraft(userBook, data, kind = 'review') {
  try { localStorage.setItem(draftKey(userBook, kind), JSON.stringify({ ...data, ts: Date.now() })); } catch (e) { /* noop */ }
}

function loadDraft(userBook, kind = 'review') {
  try {
    const raw = localStorage.getItem(draftKey(userBook, kind));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearDraft(userBook, kind = 'review') {
  try { localStorage.removeItem(draftKey(userBook, kind)); } catch (e) { /* noop */ }
}

export function openReviewModal(userBook, onDone) {
  const draft = loadDraft(userBook);
  let rating = (draft?.rating ?? userBook.rating) || 0;
  const friend = state.allUsers.find((u) => u.id !== state.currentUser.id);
  const recipient = friend ? friend.name : 'você mesma';
  let isPublic = draft ? draft.isPublic : (userBook.review_public === undefined || userBook.review_public === null ? true : !!userBook.review_public);
  const textVal = draft ? draft.text : (userBook.review_text || '');
  const quoteVal = draft ? draft.quote : (userBook.review_quote || '');
  const pageVal = draft ? draft.page : (userBook.review_page ?? '');
  const favVal = draft ? draft.fav : !!userBook.favorite;

  openModal(`
    <h3>💌 Carta sobre esse livro</h3>
    <p class="muted mt-0">${escapeHtml(userBook.book?.title || '')}</p>
    ${draft ? `<p class="muted" style="background:var(--line);padding:8px 12px;border-radius:10px">📝 Recuperamos um rascunho não salvo de antes.</p>` : ''}
    <div class="field">
      <label>Sua nota</label>
      ${starsHtml(rating, true)}
    </div>
    <div class="field">
      <label>Querida ${escapeHtml(recipient)}... (escreva sua carta)</label>
      <textarea id="f-review" rows="6" placeholder="Conta pra ela o que você achou desse livro, como se sentiu lendo...">${escapeHtml(textVal)}</textarea>
    </div>
    <div class="field">
      <label>Trecho favorito (opcional)</label>
      <div class="row-between gap-sm">
        <input id="f-quote-page" type="number" min="0" placeholder="Página" style="max-width:110px" value="${pageVal}" />
      </div>
      <textarea id="f-quote" style="margin-top:8px" placeholder="Cole aqui a frase que você quer guardar desse livro...">${escapeHtml(quoteVal)}</textarea>
    </div>
    <div class="field">
      <label>Quem pode ler essa carta?</label>
      <div class="chip-row">
        <button type="button" class="tab" data-visibility="public">🌍 Pública</button>
        <button type="button" class="tab" data-visibility="private">🔒 Só minha</button>
      </div>
    </div>
    <div class="field"><label><input type="checkbox" id="f-fav" style="width:auto;display:inline-block;margin-right:6px;" ${favVal ? 'checked' : ''}/> Marcar como favorito ⭐</label></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Salvar carta</button>
    </div>
  `, {
    onMount: (modal) => {
      const reviewEl = modal.querySelector('#f-review');
      const quoteEl = modal.querySelector('#f-quote');
      const pageEl = modal.querySelector('#f-quote-page');
      const favEl = modal.querySelector('#f-fav');

      // salva um rascunho automático a cada digitada, pra nunca mais perder o que foi escrito
      // (mesmo se a aba fechar ou a janela do BBB cair antes de clicar em Salvar).
      const persistDraft = () => saveDraft(userBook, {
        text: reviewEl.value, quote: quoteEl.value, page: pageEl.value,
        rating, isPublic, fav: favEl.checked,
      });
      [reviewEl, quoteEl, pageEl].forEach((el) => el.addEventListener('input', persistDraft));
      favEl.addEventListener('change', persistDraft);

      modal.querySelector('#f-cancel').onclick = closeModal;
      const visBtns = modal.querySelectorAll('[data-visibility]');
      const paintVisibility = () => visBtns.forEach((b) => b.classList.toggle('active', (b.dataset.visibility === 'public') === isPublic));
      paintVisibility();
      visBtns.forEach((btn) => {
        btn.onclick = () => { isPublic = btn.dataset.visibility === 'public'; paintVisibility(); persistDraft(); };
      });
      modal.querySelectorAll('.star').forEach((star) => {
        star.onclick = () => {
          rating = Number(star.dataset.value);
          modal.querySelectorAll('.star').forEach((s) => {
            s.classList.toggle('filled', Number(s.dataset.value) <= rating);
            s.textContent = Number(s.dataset.value) <= rating ? '★' : '☆';
          });
          persistDraft();
        };
      });
      modal.querySelector('#f-save').onclick = async () => {
        try {
          const pv = pageEl.value;
          const { user_book } = await api.patch(`/user-books/${userBook.id}`, {
            rating,
            review_text: reviewEl.value,
            review_quote: quoteEl.value,
            review_page: pv ? Number(pv) : null,
            review_public: isPublic ? 1 : 0,
            favorite: favEl.checked ? 1 : 0,
          });
          clearDraft(userBook);
          closeModal();
          toast('Carta salva! 💌');
          onDone && onDone(user_book);
        } catch (e) { toast(e.message); }
      };
    },
  });
}

export function openGoalModal(currentTarget, onDone) {
  openModal(`
    <h3>🎯 Meta de leitura ${new Date().getFullYear()}</h3>
    <div class="field">
      <label>Quantos livros você quer ler este ano?</label>
      <input type="number" id="f-target" min="1" value="${currentTarget || 20}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Salvar meta</button>
    </div>
  `, {
    onMount: (modal) => {
      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelector('#f-save').onclick = async () => {
        const target = Number(modal.querySelector('#f-target').value || 0);
        if (!target) return toast('Informe um número válido');
        try {
          const { goal } = await api.post('/goals', { year: new Date().getFullYear(), target_books: target });
          closeModal();
          toast('Meta definida!');
          onDone && onDone(goal);
        } catch (e) { toast(e.message); }
      };
    },
  });
}

export function openEditProfileModal(onDone) {
  const u = state.currentUser;
  const colors = ['#C9A9E9', '#F4B6C2', '#9AD1D4', '#F1B94B', '#8FBFAE', '#6B4E71'];
  openModal(`
    <h3>👤 Editar perfil</h3>
    <div class="field"><label>Nome</label><input id="f-name" value="${escapeHtml(u.name)}" /></div>
    <div class="field"><label>@usuário</label><input id="f-username" value="${escapeHtml(u.username)}" /></div>
    <div class="field"><label>Bio</label><textarea id="f-bio">${escapeHtml(u.bio || '')}</textarea></div>
    <div class="field"><label>URL da foto de perfil (opcional)</label><input id="f-avatar" value="${escapeHtml(u.avatar_url || '')}" placeholder="https://..." /></div>
    <div class="field">
      <label>Cor do avatar (se não tiver foto)</label>
      <div class="chip-row">
        ${colors.map((c) => `<button type="button" data-color="${c}" style="width:30px;height:30px;border-radius:50%;border:2px solid ${c === u.avatar_color ? '#2B2438' : 'transparent'};background:${c};cursor:pointer"></button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Nova senha (deixe em branco para manter a atual)</label><input id="f-password" type="password" placeholder="••••••••" /></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Salvar</button>
    </div>
  `, {
    onMount: (modal) => {
      let selectedColor = u.avatar_color;
      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelectorAll('[data-color]').forEach((btn) => {
        btn.onclick = () => {
          selectedColor = btn.dataset.color;
          modal.querySelectorAll('[data-color]').forEach((b) => { b.style.borderColor = 'transparent'; });
          btn.style.borderColor = '#2B2438';
        };
      });
      modal.querySelector('#f-save').onclick = async () => {
        try {
          const { user } = await api.patch('/users/me', {
            name: modal.querySelector('#f-name').value.trim(),
            username: modal.querySelector('#f-username').value.trim(),
            bio: modal.querySelector('#f-bio').value,
            avatar_url: modal.querySelector('#f-avatar').value.trim(),
            avatar_color: selectedColor,
          });
          state.currentUser = user;
          const newPassword = modal.querySelector('#f-password').value;
          if (newPassword) {
            await api.patch('/users/me/password', { password: newPassword });
          }
          closeModal();
          toast('Perfil atualizado!');
          onDone && onDone(user);
        } catch (e) { toast(e.message); }
      };
    },
  });
}

export function openAddBookModal(onAdded) {
  openModal(`
    <h3>➕ Adicionar livro</h3>
    <div class="field">
      <input id="f-search" placeholder="Buscar por título ou autor..." autofocus />
    </div>
    <div id="f-results"><p class="muted">Digite para buscar ✨</p></div>
    <hr class="divider"/>
    <button class="link-btn" id="f-manual">Prefiro cadastrar manualmente</button>
  `, {
    onMount: (modal) => {
      const resultsEl = modal.querySelector('#f-results');
      const input = modal.querySelector('#f-search');
      let debounce;
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        const q = input.value.trim();
        if (!q) { resultsEl.innerHTML = '<p class="muted">Digite para buscar ✨</p>'; return; }
        debounce = setTimeout(async () => {
          resultsEl.innerHTML = '<p class="muted"><span class="spin">⏳</span> buscando...</p>';
          try {
            const { results, warning } = await api.get(`/books/search?q=${encodeURIComponent(q)}`);
            if (!results.length) {
              resultsEl.innerHTML = `<p class="muted">Nada encontrado. ${warning ? escapeHtml(warning) : 'Tente cadastrar manualmente abaixo.'}</p>`;
              return;
            }
            resultsEl.innerHTML = (warning ? `<p class="muted">${escapeHtml(warning)}</p>` : '') + results.map((r, i) => `
              <div class="search-result" data-idx="${i}">
                ${bookCoverHtml(r)}
                <div>
                  <div class="book-title">${escapeHtml(r.title)}</div>
                  <div class="book-author">${escapeHtml(r.author || 'Autor desconhecido')}</div>
                  ${r.total_pages ? `<div class="muted">${r.total_pages} páginas</div>` : ''}
                </div>
              </div>`).join('');
            resultsEl.querySelectorAll('.search-result').forEach((elm) => {
              elm.onclick = () => openStatusPickerForBook(results[Number(elm.dataset.idx)], onAdded);
            });
          } catch (e) {
            resultsEl.innerHTML = `<p class="muted">Busca indisponível agora. Tente cadastrar manualmente abaixo.</p>`;
          }
        }, 400);
      });
      modal.querySelector('#f-manual').onclick = () => openManualBookForm(onAdded);
    },
  });
}

function openManualBookForm(onAdded) {
  let pickedDataUrl = '';
  openModal(`
    <h3>✍️ Cadastrar livro manualmente</h3>
    <div class="field"><label>Título</label><input id="f-title" /></div>
    <div class="field"><label>Autor</label><input id="f-author" /></div>
    <div class="field"><label>Total de páginas</label><input id="f-pages" type="number" min="0" /></div>
    <div class="field">
      <label>Escolher uma foto da capa (opcional)</label>
      <input type="file" accept="image/*" id="f-cover-file" />
      <div id="f-cover-preview"></div>
    </div>
    <div class="field">
      <label>Ou cole o link de uma imagem</label>
      <input id="f-cover" placeholder="https://..." />
      <button type="button" class="link-btn" id="f-find-cover" style="margin-top:6px">🔍 Buscar imagem da capa</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-next">Continuar</button>
    </div>
  `, {
    onMount: (modal) => {
      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelector('#f-find-cover').onclick = () => {
        const title = modal.querySelector('#f-title').value.trim();
        const author = modal.querySelector('#f-author').value.trim();
        const q = encodeURIComponent(`capa livro ${title} ${author}`.trim());
        window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank');
        toast('Achou a capa? Clique com o botão direito na imagem → "Copiar link da imagem" e cole aqui.');
      };
      modal.querySelector('#f-cover-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          pickedDataUrl = await fileToResizedDataUrl(file);
          modal.querySelector('#f-cover-preview').innerHTML = `<img src="${pickedDataUrl}" style="width:90px;border-radius:10px;margin-top:8px;box-shadow:var(--shadow-card)"/>`;
          modal.querySelector('#f-cover').value = '';
          modal.querySelector('#f-cover').disabled = true;
        } catch (err) { toast(err.message); }
      };
      modal.querySelector('#f-next').onclick = () => {
        const title = modal.querySelector('#f-title').value.trim();
        if (!title) return toast('Informe pelo menos o título');
        const book = {
          title,
          author: modal.querySelector('#f-author').value.trim(),
          total_pages: Number(modal.querySelector('#f-pages').value || 0),
          cover_url: pickedDataUrl || modal.querySelector('#f-cover').value.trim(),
        };
        openStatusPickerForBook(book, onAdded);
      };
    },
  });
}

function openStatusPickerForBook(book, onAdded) {
  openModal(`
    <h3>${escapeHtml(book.title)}</h3>
    <p class="muted mt-0">${escapeHtml(book.author || '')}</p>
    <div class="field">
      <label>Onde esse livro entra na sua estante?</label>
      <div class="chip-row">
        ${Object.entries(STATUS_META).map(([k, m]) => `<button type="button" class="tab" data-status="${k}">${m.emoji} ${m.label}</button>`).join('')}
      </div>
    </div>
    <div class="field" id="f-page-field" style="display:none">
      <label>Página atual</label>
      <input id="f-currentpage" type="number" min="0" value="0" />
    </div>
    <div class="modal-actions" id="f-confirm-wrap" style="display:none">
      <button class="btn btn-primary btn-block" id="f-confirm-page">Adicionar à estante</button>
    </div>
  `, {
    onMount: (modal) => {
      let chosen = null;
      const pageField = modal.querySelector('#f-page-field');
      const confirmBtn = modal.querySelector('#f-confirm-page');
      const confirmWrap = modal.querySelector('#f-confirm-wrap');
      modal.querySelectorAll('[data-status]').forEach((btn) => {
        btn.onclick = () => {
          chosen = btn.dataset.status;
          modal.querySelectorAll('[data-status]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          if (chosen === 'lendo') {
            pageField.style.display = 'block';
            confirmWrap.style.display = 'flex';
          } else {
            pageField.style.display = 'none';
            saveUserBook(book, chosen, 0, onAdded);
          }
        };
      });
      confirmBtn.onclick = () => {
        saveUserBook(book, chosen || 'lendo', Number(modal.querySelector('#f-currentpage').value || 0), onAdded);
      };
    },
  });
}

async function saveUserBook(book, status, currentPage, onAdded) {
  try {
    const { user_book } = await api.post('/user-books', { book, status, current_page: currentPage });
    closeModal();
    toast('Livro adicionado à sua estante!');
    onAdded && onAdded(user_book);
  } catch (e) {
    toast(e.message);
  }
}

export function openAddCoverModal(book, onDone) {
  let pickedDataUrl = '';
  openModal(`
    <h3>🖼️ Adicionar capa</h3>
    <p class="muted mt-0">${escapeHtml(book.title)}</p>
    <div class="field">
      <label>Escolher uma foto do celular/computador</label>
      <input type="file" accept="image/*" id="f-cover-file" />
      <div id="f-cover-preview"></div>
    </div>
    <div class="field">
      <label>Ou cole o link de uma imagem</label>
      <input id="f-cover-url" placeholder="https://..." />
      <button type="button" class="link-btn" id="f-find-cover" style="margin-top:6px">🔍 Buscar imagem da capa</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Salvar capa</button>
    </div>
  `, {
    onMount: (modal) => {
      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelector('#f-find-cover').onclick = () => {
        const q = encodeURIComponent(`capa livro ${book.title} ${book.author || ''}`.trim());
        window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank');
        toast('Clique com o botão direito na imagem → "Copiar link da imagem" e cole aqui.');
      };
      modal.querySelector('#f-cover-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          pickedDataUrl = await fileToResizedDataUrl(file);
          modal.querySelector('#f-cover-preview').innerHTML = `<img src="${pickedDataUrl}" style="width:90px;border-radius:10px;margin-top:8px;box-shadow:var(--shadow-card)"/>`;
          modal.querySelector('#f-cover-url').value = '';
          modal.querySelector('#f-cover-url').disabled = true;
        } catch (err) { toast(err.message); }
      };
      modal.querySelector('#f-save').onclick = async () => {
        const coverUrl = pickedDataUrl || modal.querySelector('#f-cover-url').value.trim();
        if (!coverUrl) return toast('Escolha uma foto ou cole o link de uma imagem primeiro');
        try {
          await api.patch(`/books/${book.id}`, { cover_url: coverUrl });
          closeModal();
          toast('Capa adicionada! ✨');
          onDone && onDone();
        } catch (e) { toast(e.message); }
      };
    },
  });
}

export function openEditBookModal(book, onDone) {
  openModal(`
    <h3>✏️ Editar informações do livro</h3>
    <p class="muted mt-0">Isso vale pras duas — é o cadastro do livro, não da sua leitura.</p>
    <div class="field"><label>Título</label><input id="f-title" value="${escapeHtml(book.title)}" /></div>
    <div class="field"><label>Autor</label><input id="f-author" value="${escapeHtml(book.author || '')}" /></div>
    <div class="field"><label>Total de páginas</label><input id="f-pages" type="number" min="0" value="${book.total_pages || ''}" /></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">Salvar</button>
    </div>
  `, {
    onMount: (modal) => {
      modal.querySelector('#f-cancel').onclick = closeModal;
      modal.querySelector('#f-save').onclick = async () => {
        const title = modal.querySelector('#f-title').value.trim();
        if (!title) return toast('O título não pode ficar vazio');
        try {
          await api.patch(`/books/${book.id}`, {
            title,
            author: modal.querySelector('#f-author').value.trim(),
            total_pages: Number(modal.querySelector('#f-pages').value || 0),
          });
          closeModal();
          toast('Informações atualizadas!');
          onDone && onDone();
        } catch (e) { toast(e.message); }
      };
    },
  });
}
