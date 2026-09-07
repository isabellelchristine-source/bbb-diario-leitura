// notifications.js — central de notificações (aba "Avisos"): tudo que a amiga fez, com
// destaque lilás nas que ainda não foram vistas. Tocar numa notificação leva direto pro
// trecho certo (a carta, a anotação do diário, etc.) dentro do livro.
import { api } from '../api.js';
import { timeAgo, escapeHtml } from '../components.js';
import { state } from '../state.js';
import { navigate } from '../router.js';

const KIND_ICON = {
  journal: '💭',
  comment: '💬',
  review_comment: '💌',
  review: '💌',
  finished: '✅',
  progress: '📖',
  status: '📚',
};

export async function renderNotifications(view) {
  view.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">carregando avisos... 🔔</p>`;

  const friend = state.allUsers.find((u) => u.id !== state.currentUser.id);
  const { notifications } = await api.get('/notifications');

  view.innerHTML = `
    <div class="row-between" style="margin-bottom:4px">
      <h2 class="mt-0 mb-0">🔔 Notificações</h2>
      ${friend ? `<button class="link-btn" id="go-to-profile">👤 Perfil de ${escapeHtml(friend.name)}</button>` : ''}
    </div>
    <p class="muted mt-0" style="margin-bottom:14px">Tudo que ${friend ? escapeHtml(friend.name) : 'sua amiga'} fez por aqui. Toque numa notificação pra ir direto nela.</p>
    ${notifications.length ? `<div class="notification-list">
      ${notifications.map((n) => `
        <div class="notification-row${n.read ? '' : ' unread'}" data-notif-book="${n.bookId || ''}" data-notif-focus="${n.focus || ''}">
          <span class="notification-icon">${KIND_ICON[n.kind] || '🔔'}</span>
          <div class="notification-body">
            <div class="notification-message">${escapeHtml(n.message)}</div>
            <div class="muted notification-time">${timeAgo(n.at)}</div>
          </div>
          ${!n.read ? '<span class="notification-dot" title="Novo"></span>' : ''}
        </div>`).join('')}
    </div>` : `
      <div class="empty-state">
        <div class="emoji">🔔</div>
        <p>Nenhuma notificação ainda.<br/>Assim que ${friend ? escapeHtml(friend.name) : 'ela'} escrever, comentar ou terminar um livro, aparece aqui.</p>
      </div>`}
  `;

  const profileBtn = view.querySelector('#go-to-profile');
  if (profileBtn && friend) profileBtn.onclick = () => navigate(`/user/${friend.username}`);

  view.querySelectorAll('[data-notif-book]').forEach((row) => {
    const bookId = row.dataset.notifBook;
    if (!bookId) return;
    row.style.cursor = 'pointer';
    row.onclick = () => {
      const focus = row.dataset.notifFocus;
      navigate(`/book/${bookId}${focus ? `?focus=${encodeURIComponent(focus)}` : ''}`);
    };
  });
}
