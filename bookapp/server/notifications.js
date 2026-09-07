// notifications.js — monta a lista de "coisas que a amiga fez" (diário, comentários, cartas,
// progresso) pra alimentar tanto o sininho de novidade na barra de navegação quanto a tela
// cheia de notificações. Não existe uma tabela própria de notificações: cada evento é
// derivado ao vivo das tabelas que já existem (journal_entries, comments, user_books), então
// o "histórico" é sempre a atividade de verdade, sem duplicar dado.
import db from './db.js';

const MAX_EVENTS = 40;

// Constrói a lista de eventos gerados por `otherUserId`, do ponto de vista de quem está
// olhando. Cada evento tem um id estável (pra marcar como lido/dar deep-link) e diz pra
// onde navegar quando a pessoa tocar nele.
export async function buildEvents(otherUserId) {
  const other = await db.get('SELECT * FROM users WHERE id = ?', [otherUserId]);
  if (!other) return [];
  const events = [];

  // anotações do diário que ela escreveu
  const journalRows = await db.all(
    'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [otherUserId, MAX_EVENTS],
  );
  for (const j of journalRows) {
    const ub = await db.get('SELECT * FROM user_books WHERE id = ?', [j.user_book_id]);
    const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
    events.push({
      id: `journal_${j.id}`,
      at: j.created_at,
      kind: 'journal',
      message: `${other.name} escreveu sobre "${book?.title || 'um livro'}"`,
      bookId: ub?.book_id || null,
      focus: `journal_${j.id}`,
    });
  }

  // comentários dela (no diário de qualquer uma das duas)
  const commentRows = await db.all(
    'SELECT * FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [otherUserId, MAX_EVENTS],
  );
  for (const c of commentRows) {
    const journal = await db.get('SELECT * FROM journal_entries WHERE id = ?', [c.journal_id]);
    const ub = journal ? await db.get('SELECT * FROM user_books WHERE id = ?', [journal.user_book_id]) : null;
    const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
    events.push({
      id: `comment_${c.id}`,
      at: c.created_at,
      kind: 'comment',
      message: `${other.name} comentou em uma atualização sobre "${book?.title || 'um livro'}"`,
      bookId: ub?.book_id || null,
      focus: journal ? `journal_${journal.id}` : null,
    });
  }

  // comentários dela nas cartas/resenhas (de qualquer uma das duas)
  const reviewCommentRows = await db.all(
    'SELECT * FROM review_comments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [otherUserId, MAX_EVENTS],
  );
  for (const rc of reviewCommentRows) {
    const ub = await db.get('SELECT * FROM user_books WHERE id = ?', [rc.user_book_id]);
    const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
    events.push({
      id: `reviewcomment_${rc.id}`,
      at: rc.created_at,
      kind: 'review_comment',
      message: `${other.name} comentou na carta de "${book?.title || 'um livro'}"`,
      bookId: ub?.book_id || null,
      focus: 'review',
    });
  }

  // livros marcados como lido, cartas escritas, ou progresso atualizado
  const ubRows = await db.all(
    'SELECT * FROM user_books WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
    [otherUserId, MAX_EVENTS],
  );
  for (const ub of ubRows) {
    const book = await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]);
    let message; let kind = 'status'; let focus = null;
    if (ub.status === 'lido' && ub.review_text) { message = `${other.name} escreveu uma carta sobre "${book?.title || 'um livro'}"`; kind = 'review'; focus = 'review'; }
    else if (ub.status === 'lido') { message = `${other.name} terminou "${book?.title || 'um livro'}"`; kind = 'finished'; }
    else if (ub.status === 'lendo') { message = `${other.name} atualizou o progresso em "${book?.title || 'um livro'}" (página ${ub.current_page})`; kind = 'progress'; }
    else { message = `${other.name} atualizou "${book?.title || 'um livro'}"`; }
    events.push({
      id: `ub_${ub.id}_${ub.updated_at}`,
      at: ub.updated_at,
      kind,
      message,
      bookId: ub.book_id,
      focus,
    });
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events.slice(0, MAX_EVENTS);
}

// Devolve a lista já com `read` calculado a partir do last_seen_at de quem está olhando.
export async function buildNotifications(viewerId, otherUserId) {
  const viewer = await db.get('SELECT * FROM users WHERE id = ?', [viewerId]);
  const since = viewer?.last_seen_at || viewer?.created_at || new Date(0).toISOString();
  const events = await buildEvents(otherUserId);
  const notifications = events.map((e) => ({ ...e, read: new Date(e.at) <= new Date(since) }));
  const unread_count = notifications.filter((n) => !n.read).length;
  return { notifications, unread_count };
}
