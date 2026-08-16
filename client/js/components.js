// components.js — helpers de renderização (strings HTML) reutilizados pelas views.

// Lê um arquivo de imagem escolhido no dispositivo, redimensiona (pra não pesar no banco)
// e devolve como data URL — pronto pra salvar direto no campo cover_url, sem precisar
// de nenhum serviço de armazenamento externo.
export function fileToResizedDataUrl(file, maxDim = 600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não consegui ler essa imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Esse arquivo não parece ser uma imagem válida.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function avatarHtml(user, size = 44) {
  if (!user) return `<div class="avatar" style="width:${size}px;height:${size}px;background:#C9A9E9"></div>`;
  const fontSize = Math.round(size * 0.38);
  if (user.avatar_url) {
    return `<div class="avatar" style="width:${size}px;height:${size}px"><img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.name)}"/></div>`;
  }
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${user.avatar_color || '#C9A9E9'};font-size:${fontSize}px">${initials(user.name)}</div>`;
}

export function starsHtml(rating, interactive = false) {
  const r = Math.round((rating || 0) * 2) / 2;
  let html = `<span class="stars${interactive ? ' interactive' : ''}" ${interactive ? 'data-stars' : ''}>`;
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(r);
    html += `<span class="star${filled ? ' filled' : ''}" data-value="${i}">${filled ? '★' : '☆'}</span>`;
  }
  html += '</span>';
  return html;
}

export function progressHtml(current, total, colorClass = '') {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return `
    <div class="progress-row">
      <div class="progress-track"><div class="progress-fill ${colorClass}" style="width:${pct}%"></div></div>
      <div class="progress-pct">${pct}%</div>
    </div>`;
}

export function bookCoverHtml(book, size = 'md') {
  const cls = size === 'lg' ? 'book-cover lg' : 'book-cover';
  if (book && book.cover_url) {
    return `<div class="${cls}"><img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(book.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/></div>`;
  }
  return `<div class="${cls}">📖</div>`;
}

export function shelfCoverHtml(book) {
  if (book && book.cover_url) {
    return `<div class="book-cover"><img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(book.title)}"/></div>`;
  }
  return `<div class="book-cover"><span class="placeholder-emoji">📖</span></div>`;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hoje, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'ontem';
  if (day < 7) return `há ${day} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

export function statusPillHtml(status, meta) {
  const m = meta[status] || { label: status, emoji: '' };
  const colorMap = { plum: '', lavender: 'gold', sage: 'sage', gold: 'gold', blush: 'blush' };
  return `<span class="pill ${colorMap[m.color] || ''}">${m.emoji} ${m.label}</span>`;
}

// Lista de comentários + campo pra escrever um novo, embaixo de uma atualização do diário.
export function commentsHtml(entry) {
  const comments = entry.comments || [];
  return `
    <div class="comments-block" data-comments-for="${entry.id}">
      ${comments.length ? `<div class="comments-list">
        ${comments.map((c) => `
          <div class="comment-row">
            <strong>${escapeHtml(c.user?.name || '')}</strong> ${escapeHtml(c.text)}
            <span class="muted comment-time">${timeAgo(c.created_at)}</span>
          </div>`).join('')}
      </div>` : ''}
      <div class="comment-input-row">
        <input type="text" placeholder="Escreva um comentário..." data-comment-input="${entry.id}" />
        <button class="icon-btn" data-comment-send="${entry.id}" title="Enviar">➤</button>
      </div>
    </div>`;
}

// Renderiza a resenha como uma cartinha (formato "carta de leitura").
// authorName = quem escreveu; recipientName = pra quem a carta é endereçada.
export function letterHtml(ub, authorName, recipientName) {
  if (ub.review_hidden) {
    return `<div class="letter-card letter-locked">
      <div class="letter-locked-inner">🔒<p class="muted mt-0 mb-0">${escapeHtml(authorName)} guardou essa carta só para ela por enquanto.</p></div>
    </div>`;
  }
  if (!ub.review_text) return '';
  return `
    <div class="letter-card">
      <div class="letter-greeting">Querida ${escapeHtml(recipientName)}...</div>
      <div class="letter-body">${escapeHtml(ub.review_text).replace(/\n/g, '<br/>')}</div>
      ${ub.review_quote ? `
        <div class="letter-quote">
          ${ub.review_page ? `<div class="letter-quote-page">Página ${ub.review_page}</div>` : ''}
          <div class="letter-quote-text">"${escapeHtml(ub.review_quote)}"</div>
        </div>` : ''}
      <div class="letter-signature">Com carinho,<br/>${escapeHtml(authorName)}</div>
    </div>`;
}

// cria elemento(s) DOM a partir de uma string HTML
export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}
