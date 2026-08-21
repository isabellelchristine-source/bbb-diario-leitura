// server.js — servidor HTTP único (API + arquivos estáticos do client).
// Local: só precisa do Node.js 22+. Em produção: pode usar Turso (banco na nuvem) via variáveis de ambiente.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { initDb } from './db.js';
import { hashPassword, verifyPassword, createSession, getUserFromToken, destroySession, publicUser } from './auth.js';
import { sendJson, readBody, getToken, newId, nowIso, redactReview } from './util.js';
import { computeStats, currentlyReading, getUserBooks } from './stats.js';
import { searchGoogleBooks, searchOpenLibrary } from './bookSources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(CLIENT_DIR, filePath);
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403); res.end(); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback -> index.html for client-side routes
      fs.readFile(path.join(CLIENT_DIR, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    // nunca deixa o navegador guardar HTML/CSS/JS em cache — sempre pega a versão mais nova.
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  });
}

async function requireAuth(req, res) {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user) {
    sendJson(res, 401, { error: 'não autenticado' });
    return null;
  }
  return user;
}

// Para rotas de leitura pública (perfil, estante) que também precisam saber
// "quem está olhando" pra decidir se mostra uma carta privada ou não.
async function optionalUser(req) {
  const token = getToken(req);
  return getUserFromToken(token);
}

async function ensureBook(input) {
  // input: { id? , title, author, cover_url, total_pages, synopsis, isbn, source_id }
  if (input.id) {
    const existing = await db.get('SELECT * FROM books WHERE id = ?', [input.id]);
    if (existing) return existing;
  }
  if (input.source_id) {
    const existing = await db.get('SELECT * FROM books WHERE source_id = ?', [input.source_id]);
    if (existing) return existing;
  }
  const id = newId('book');
  await db.run(
    `INSERT INTO books (id, title, author, cover_url, total_pages, synopsis, isbn, source_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.title || 'Sem título', input.author || '', input.cover_url || '', input.total_pages || 0,
      input.synopsis || '', input.isbn || '', input.source_id || '', nowIso()],
  );
  return db.get('SELECT * FROM books WHERE id = ?', [id]);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;
    const method = req.method;

    // CORS (útil se abrir o client em outra origem durante o desenvolvimento)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (!pathname.startsWith('/api/')) {
      return serveStatic(req, res, pathname);
    }

    // ---------- AUTH ----------
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await readBody(req);
      const { name, username, password, bio } = body;
      if (!name || !username || !password) return sendJson(res, 400, { error: 'nome, usuário e senha são obrigatórios' });
      const exists = await db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
      if (exists) return sendJson(res, 409, { error: 'esse @usuário já existe' });
      const { hash, salt } = hashPassword(password);
      const id = newId('user');
      const colors = ['#C9A9E9', '#F4B6C2', '#9AD1D4', '#F6D186', '#B8E0D2'];
      const avatar_color = colors[Math.floor(Math.random() * colors.length)];
      await db.run(
        `INSERT INTO users (id, name, username, bio, avatar_color, avatar_url, password_hash, password_salt, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, username.toLowerCase(), bio || '', avatar_color, '', hash, salt, nowIso()],
      );
      const token = await createSession(id);
      const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
      return sendJson(res, 201, { token, user: publicUser(user) });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await readBody(req);
      const { username, password } = body;
      const user = await db.get('SELECT * FROM users WHERE username = ?', [(username || '').toLowerCase()]);
      if (!user || !verifyPassword(password || '', user.password_hash, user.password_salt)) {
        return sendJson(res, 401, { error: 'usuário ou senha inválidos' });
      }
      const token = await createSession(user.id);
      return sendJson(res, 200, { token, user: publicUser(user) });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = getToken(req);
      if (token) await destroySession(token);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = await requireAuth(req, res); if (!user) return;
      return sendJson(res, 200, { user: publicUser(user) });
    }

    // ---------- USERS ----------
    if (pathname === '/api/users' && method === 'GET') {
      const rows = await db.all('SELECT * FROM users ORDER BY created_at ASC');
      return sendJson(res, 200, { users: rows.map(publicUser) });
    }

    const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && method === 'GET') {
      const username = decodeURIComponent(userMatch[1]);
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) return sendJson(res, 404, { error: 'usuária não encontrada' });
      const viewer = await optionalUser(req);
      const stats = await computeStats(user.id);
      stats.best_book = redactReview(stats.best_book, viewer?.id);
      stats.worst_book = redactReview(stats.worst_book, viewer?.id);
      const reading = await currentlyReading(user.id);
      return sendJson(res, 200, { user: publicUser(user), stats, currently_reading: reading });
    }

    if (pathname === '/api/users/me' && method === 'PATCH') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      const fields = ['name', 'bio', 'avatar_color', 'avatar_url', 'username'];
      const updates = [];
      const values = [];
      for (const f of fields) {
        if (body[f] !== undefined) {
          updates.push(`${f} = ?`);
          values.push(f === 'username' ? String(body[f]).toLowerCase() : body[f]);
        }
      }
      if (updates.length) {
        values.push(user.id);
        await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      const updated = await db.get('SELECT * FROM users WHERE id = ?', [user.id]);
      return sendJson(res, 200, { user: publicUser(updated) });
    }

    if (pathname === '/api/users/me/password' && method === 'PATCH') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      if (!body.password) return sendJson(res, 400, { error: 'senha obrigatória' });
      const { hash, salt } = hashPassword(body.password);
      await db.run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [hash, salt, user.id]);
      return sendJson(res, 200, { ok: true });
    }

    // ---------- BOOKS ----------
    if (pathname === '/api/books/search' && method === 'GET') {
      const q = url.searchParams.get('q');
      if (!q) return sendJson(res, 400, { error: 'informe q=' });

      // 1ª tentativa: Google Books. 2ª tentativa: Open Library. Cada uma com timeout curto
      // pra não deixar a busca travada caso a rede (ex: proxy corporativo) bloqueie um dos dois.
      try {
        const results = await searchGoogleBooks(q);
        if (results.length) return sendJson(res, 200, { results, source: 'google_books' });
        throw new Error('google books sem resultados');
      } catch (e1) {
        try {
          const results = await searchOpenLibrary(q);
          if (results.length) return sendJson(res, 200, { results, source: 'open_library' });
          throw new Error('open library sem resultados');
        } catch (e2) {
          const like = `%${q}%`;
          const local = await db.all('SELECT * FROM books WHERE title LIKE ? OR author LIKE ? LIMIT 20', [like, like]);
          return sendJson(res, 200, {
            results: local,
            source: 'local',
            warning: local.length
              ? 'busca externa indisponível agora — mostrando só livros já cadastrados. Se a rede do seu Wi-Fi/trabalho bloquear APIs externas, cadastre manualmente e cole a capa você mesma.'
              : 'busca externa indisponível agora. Cadastre manualmente abaixo (dá pra colar o link de uma capa também).',
          });
        }
      }
    }

    if (pathname === '/api/books' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      const book = await ensureBook(body);
      return sendJson(res, 201, { book });
    }

    const bookMatch = pathname.match(/^\/api\/books\/([^/]+)$/);
    if (bookMatch && method === 'GET') {
      const book = await db.get('SELECT * FROM books WHERE id = ?', [bookMatch[1]]);
      if (!book) return sendJson(res, 404, { error: 'livro não encontrado' });
      return sendJson(res, 200, { book });
    }

    if (bookMatch && method === 'PATCH') {
      // Dados do livro (capa, páginas, autor, sinopse) são compartilhados entre as duas —
      // qualquer uma pode completar/corrigir, não é dado pessoal.
      const user = await requireAuth(req, res); if (!user) return;
      const book = await db.get('SELECT * FROM books WHERE id = ?', [bookMatch[1]]);
      if (!book) return sendJson(res, 404, { error: 'livro não encontrado' });
      const body = await readBody(req);
      const fields = ['title', 'cover_url', 'total_pages', 'author', 'synopsis', 'isbn'];
      const updates = []; const values = [];
      for (const f of fields) if (body[f] !== undefined) { updates.push(`${f} = ?`); values.push(body[f]); }
      if (updates.length) {
        values.push(book.id);
        await db.run(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      return sendJson(res, 200, { book: await db.get('SELECT * FROM books WHERE id = ?', [book.id]) });
    }

    // ---------- USER BOOKS (estante) ----------
    if (pathname === '/api/user-books' && method === 'GET') {
      const userId = url.searchParams.get('user_id');
      const status = url.searchParams.get('status');
      if (!userId) return sendJson(res, 400, { error: 'informe user_id' });
      const viewer = await optionalUser(req);
      const list = await getUserBooks(userId, status);
      const rows = list.map((ub) => redactReview(ub, viewer?.id));
      return sendJson(res, 200, { user_books: rows });
    }

    const ubMatch = pathname.match(/^\/api\/user-books\/([^/]+)$/);
    if (ubMatch && method === 'GET') {
      const row = await db.get('SELECT * FROM user_books WHERE id = ?', [ubMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      const book = await db.get('SELECT * FROM books WHERE id = ?', [row.book_id]);
      const viewer = await optionalUser(req);
      return sendJson(res, 200, { user_book: redactReview({ ...row, book }, viewer?.id) });
    }

    if (pathname === '/api/user-books' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      const book = await ensureBook(body.book || {});
      const existing = await db.get('SELECT * FROM user_books WHERE user_id = ? AND book_id = ?', [user.id, book.id]);
      if (existing) return sendJson(res, 409, { error: 'esse livro já está na sua estante', user_book: existing });
      const id = newId('ub');
      const status = body.status || 'quero_ler';
      const now = nowIso();
      await db.run(
        `INSERT INTO user_books
        (id, user_id, book_id, status, current_page, start_date, finish_date, goal_date, rating, review_text, favorite, personal_comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user.id, book.id, status, body.current_page || 0,
          body.start_date || (status === 'lendo' ? now : null), body.finish_date || null, body.goal_date || null,
          null, '', 0, '', now, now],
      );
      const row = await db.get('SELECT * FROM user_books WHERE id = ?', [id]);
      return sendJson(res, 201, { user_book: { ...row, book } });
    }

    if (ubMatch && method === 'PATCH') {
      const user = await requireAuth(req, res); if (!user) return;
      const row = await db.get('SELECT * FROM user_books WHERE id = ?', [ubMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      if (row.user_id !== user.id) return sendJson(res, 403, { error: 'não é sua estante' });
      const body = await readBody(req);
      const fields = ['status', 'current_page', 'start_date', 'finish_date', 'finish_date_precision', 'goal_date', 'rating', 'review_text', 'favorite', 'personal_comment', 'review_public', 'review_page', 'review_quote', 'review_style'];
      const updates = [];
      const values = [];
      for (const f of fields) {
        if (body[f] !== undefined) { updates.push(`${f} = ?`); values.push(body[f]); }
      }
      // status transitions: define datas automaticamente
      if (body.status === 'lendo' && !row.start_date && body.start_date === undefined) {
        updates.push('start_date = ?'); values.push(nowIso());
      }
      if (body.status === 'lido' && body.finish_date === undefined) {
        updates.push('finish_date = ?'); values.push(nowIso());
        if (body.finish_date_precision === undefined) { updates.push('finish_date_precision = ?'); values.push('day'); }
      }
      // Sempre que uma data de término de verdade é informada (pela usuária, editando manualmente),
      // ela vale mais que qualquer estimativa de "só o ano" que possa ter vindo de uma importação antiga.
      if (body.finish_date !== undefined && body.finish_date_precision === undefined) {
        updates.push('finish_date_precision = ?'); values.push('day');
      }
      updates.push('updated_at = ?'); values.push(nowIso());
      values.push(row.id);
      await db.run(`UPDATE user_books SET ${updates.join(', ')} WHERE id = ?`, values);
      const updated = await db.get('SELECT * FROM user_books WHERE id = ?', [row.id]);
      const book = await db.get('SELECT * FROM books WHERE id = ?', [updated.book_id]);
      return sendJson(res, 200, { user_book: { ...updated, book } });
    }

    if (ubMatch && method === 'DELETE') {
      const user = await requireAuth(req, res); if (!user) return;
      const row = await db.get('SELECT * FROM user_books WHERE id = ?', [ubMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      if (row.user_id !== user.id) return sendJson(res, 403, { error: 'não é sua estante' });
      await db.run('DELETE FROM journal_entries WHERE user_book_id = ?', [row.id]);
      await db.run('DELETE FROM user_books WHERE id = ?', [row.id]);
      return sendJson(res, 200, { ok: true });
    }

    // ---------- JOURNAL (diário) ----------
    if (pathname === '/api/journal' && method === 'GET') {
      const userBookId = url.searchParams.get('user_book_id');
      const userId = url.searchParams.get('user_id');
      const limit = Number(url.searchParams.get('limit') || 50);
      let rows;
      if (userBookId) {
        rows = await db.all('SELECT * FROM journal_entries WHERE user_book_id = ? ORDER BY created_at DESC', [userBookId]);
      } else if (userId) {
        rows = await db.all('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
      } else {
        rows = await db.all('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT ?', [limit]);
      }
      const enriched = await Promise.all(rows.map(async (r) => {
        const ub = await db.get('SELECT * FROM user_books WHERE id = ?', [r.user_book_id]);
        const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
        const reactions = await db.all('SELECT * FROM reactions WHERE journal_id = ?', [r.id]);
        const commentRows = await db.all('SELECT * FROM comments WHERE journal_id = ? ORDER BY created_at ASC', [r.id]);
        const comments = await Promise.all(commentRows.map(async (c) => {
          const commenter = await db.get('SELECT * FROM users WHERE id = ?', [c.user_id]);
          return { ...c, user: publicUser(commenter) };
        }));
        return { ...r, book, reactions, comments, book_id: ub ? ub.book_id : null };
      }));
      return sendJson(res, 200, { entries: enriched });
    }

    if (pathname === '/api/journal' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      if (!body.user_book_id || !body.text) return sendJson(res, 400, { error: 'user_book_id e text são obrigatórios' });
      const ub = await db.get('SELECT * FROM user_books WHERE id = ?', [body.user_book_id]);
      if (!ub || ub.user_id !== user.id) return sendJson(res, 403, { error: 'não autorizada' });
      const id = newId('journal');
      await db.run(
        `INSERT INTO journal_entries (id, user_book_id, user_id, text, emoji, page, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, body.user_book_id, user.id, body.text, body.emoji || '', body.page ?? ub.current_page, nowIso()],
      );
      const row = await db.get('SELECT * FROM journal_entries WHERE id = ?', [id]);
      return sendJson(res, 201, { entry: row });
    }

    const journalMatch = pathname.match(/^\/api\/journal\/([^/]+)$/);
    if (journalMatch && method === 'PATCH') {
      const user = await requireAuth(req, res); if (!user) return;
      const row = await db.get('SELECT * FROM journal_entries WHERE id = ?', [journalMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      if (row.user_id !== user.id) return sendJson(res, 403, { error: 'não autorizada' });
      const body = await readBody(req);
      const fields = ['text', 'emoji', 'page'];
      const updates = []; const values = [];
      for (const f of fields) if (body[f] !== undefined) { updates.push(`${f} = ?`); values.push(body[f]); }
      if (updates.length) {
        values.push(row.id);
        await db.run(`UPDATE journal_entries SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      return sendJson(res, 200, { entry: await db.get('SELECT * FROM journal_entries WHERE id = ?', [row.id]) });
    }

    if (journalMatch && method === 'DELETE') {
      const user = await requireAuth(req, res); if (!user) return;
      const row = await db.get('SELECT * FROM journal_entries WHERE id = ?', [journalMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      if (row.user_id !== user.id) return sendJson(res, 403, { error: 'não autorizada' });
      await db.run('DELETE FROM reactions WHERE journal_id = ?', [row.id]);
      await db.run('DELETE FROM comments WHERE journal_id = ?', [row.id]);
      await db.run('DELETE FROM journal_entries WHERE id = ?', [row.id]);
      return sendJson(res, 200, { ok: true });
    }

    // ---------- COMENTÁRIOS (nas atualizações do diário) ----------
    if (pathname === '/api/comments' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      if (!body.journal_id || !body.text || !body.text.trim()) return sendJson(res, 400, { error: 'journal_id e text são obrigatórios' });
      const journal = await db.get('SELECT * FROM journal_entries WHERE id = ?', [body.journal_id]);
      if (!journal) return sendJson(res, 404, { error: 'atualização não encontrada' });
      const id = newId('cmt');
      await db.run('INSERT INTO comments (id, journal_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)', [id, body.journal_id, user.id, body.text.trim(), nowIso()]);
      const row = await db.get('SELECT * FROM comments WHERE id = ?', [id]);
      return sendJson(res, 201, { comment: { ...row, user: publicUser(user) } });
    }

    const commentMatch = pathname.match(/^\/api\/comments\/([^/]+)$/);
    if (commentMatch && method === 'PATCH') {
      const user = await requireAuth(req, res); if (!user) return;
      const row = await db.get('SELECT * FROM comments WHERE id = ?', [commentMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      if (row.user_id !== user.id) return sendJson(res, 403, { error: 'não é seu comentário' });
      const body = await readBody(req);
      if (!body.text || !body.text.trim()) return sendJson(res, 400, { error: 'texto obrigatório' });
      await db.run('UPDATE comments SET text = ? WHERE id = ?', [body.text.trim(), row.id]);
      const updated = await db.get('SELECT * FROM comments WHERE id = ?', [row.id]);
      return sendJson(res, 200, { comment: { ...updated, user: publicUser(user) } });
    }

    if (commentMatch && method === 'DELETE') {
      const user = await requireAuth(req, res); if (!user) return;
      const row = await db.get('SELECT * FROM comments WHERE id = ?', [commentMatch[1]]);
      if (!row) return sendJson(res, 404, { error: 'não encontrado' });
      if (row.user_id !== user.id) return sendJson(res, 403, { error: 'não é seu comentário' });
      await db.run('DELETE FROM comments WHERE id = ?', [row.id]);
      return sendJson(res, 200, { ok: true });
    }

    // ---------- REACTIONS ----------
    if (pathname === '/api/reactions' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      if (!body.journal_id || !body.emoji) return sendJson(res, 400, { error: 'journal_id e emoji obrigatórios' });
      const existing = await db.get('SELECT * FROM reactions WHERE journal_id = ? AND user_id = ? AND emoji = ?', [body.journal_id, user.id, body.emoji]);
      if (existing) {
        await db.run('DELETE FROM reactions WHERE id = ?', [existing.id]);
        return sendJson(res, 200, { removed: true });
      }
      const id = newId('rx');
      await db.run('INSERT INTO reactions (id, journal_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)', [id, body.journal_id, user.id, body.emoji, nowIso()]);
      return sendJson(res, 201, { reaction: await db.get('SELECT * FROM reactions WHERE id = ?', [id]) });
    }

    // ---------- GOALS ----------
    if (pathname === '/api/goals' && method === 'GET') {
      const userId = url.searchParams.get('user_id');
      const year = Number(url.searchParams.get('year') || new Date().getFullYear());
      const row = await db.get('SELECT * FROM goals WHERE user_id = ? AND year = ?', [userId, year]);
      return sendJson(res, 200, { goal: row || null });
    }

    if (pathname === '/api/goals' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      const body = await readBody(req);
      const year = body.year || new Date().getFullYear();
      const existing = await db.get('SELECT * FROM goals WHERE user_id = ? AND year = ?', [user.id, year]);
      if (existing) {
        await db.run('UPDATE goals SET target_books = ? WHERE id = ?', [body.target_books, existing.id]);
      } else {
        await db.run('INSERT INTO goals (id, user_id, year, target_books) VALUES (?, ?, ?, ?)', [newId('goal'), user.id, year, body.target_books]);
      }
      const row = await db.get('SELECT * FROM goals WHERE user_id = ? AND year = ?', [user.id, year]);
      return sendJson(res, 200, { goal: row });
    }

    // ---------- STATS ----------
    const statsMatch = pathname.match(/^\/api\/stats\/([^/]+)$/);
    if (statsMatch && method === 'GET') {
      const viewer = await optionalUser(req);
      const stats = await computeStats(statsMatch[1]);
      stats.best_book = redactReview(stats.best_book, viewer?.id);
      stats.worst_book = redactReview(stats.worst_book, viewer?.id);
      return sendJson(res, 200, { stats });
    }

    // ---------- FEED (home) ----------
    if (pathname === '/api/feed' && method === 'GET') {
      const viewer = await optionalUser(req);
      const users = await db.all('SELECT * FROM users ORDER BY created_at ASC');
      const reading = await Promise.all(users.map(async (u) => ({ user: publicUser(u), books: await currentlyReading(u.id) })));
      const recentJournalRows = await db.all('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 15');
      const recentJournal = await Promise.all(recentJournalRows.map(async (r) => {
        const ub = await db.get('SELECT * FROM user_books WHERE id = ?', [r.user_book_id]);
        const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
        const u = users.find((x) => x.id === r.user_id);
        const reactions = await db.all('SELECT * FROM reactions WHERE journal_id = ?', [r.id]);
        return { ...r, book, user: publicUser(u), reactions };
      }));
      // "Últimos livros finalizados" mostra prioritariamente os da amiga — ver o que
      // você mesma já sabe que leu é menos interessante do que ver a novidade dela.
      let recentlyFinishedRows = await db.all("SELECT * FROM user_books WHERE status = 'lido' ORDER BY finish_date DESC LIMIT 20");
      if (viewer) {
        const friendRows = recentlyFinishedRows.filter((r) => r.user_id !== viewer.id);
        recentlyFinishedRows = (friendRows.length ? friendRows : recentlyFinishedRows).slice(0, 10);
      } else {
        recentlyFinishedRows = recentlyFinishedRows.slice(0, 10);
      }
      const recentlyFinished = await Promise.all(recentlyFinishedRows.map(async (r) => {
        const book = await db.get('SELECT * FROM books WHERE id = ?', [r.book_id]);
        const u = users.find((x) => x.id === r.user_id);
        return { ...r, book, user: publicUser(u) };
      }));
      return sendJson(res, 200, { reading, recent_journal: recentJournal, recently_finished: recentlyFinished });
    }

    // ---------- ATIVIDADE (indicador de "novidade" da amiga, sem push real) ----------
    if (pathname === '/api/users/me/seen' && method === 'POST') {
      const user = await requireAuth(req, res); if (!user) return;
      await db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowIso(), user.id]);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/activity/unseen' && method === 'GET') {
      const user = await requireAuth(req, res); if (!user) return;
      const since = user.last_seen_at || user.created_at;
      const others = await db.all('SELECT * FROM users WHERE id != ?', [user.id]);
      const events = [];

      for (const other of others) {
        // atualizações de diário que ela escreveu
        const newJournal = await db.all('SELECT * FROM journal_entries WHERE user_id = ? AND created_at > ?', [other.id, since]);
        for (const j of newJournal) {
          const ub = await db.get('SELECT * FROM user_books WHERE id = ?', [j.user_book_id]);
          const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
          events.push({
            at: j.created_at,
            message: `${other.name} escreveu sobre "${book?.title || 'um livro'}"`,
            bookId: ub?.book_id || null,
          });
        }

        // comentários dela em qualquer atualização (inclusive nas suas)
        const newComments = await db.all('SELECT * FROM comments WHERE user_id = ? AND created_at > ?', [other.id, since]);
        for (const c of newComments) {
          const journal = await db.get('SELECT * FROM journal_entries WHERE id = ?', [c.journal_id]);
          const ub = journal ? await db.get('SELECT * FROM user_books WHERE id = ?', [journal.user_book_id]) : null;
          const book = ub ? await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]) : null;
          events.push({
            at: c.created_at,
            message: `${other.name} comentou em uma atualização sobre "${book?.title || 'um livro'}"`,
            bookId: ub?.book_id || null,
          });
        }

        // livros marcados como lido, ou cartas escritas
        const changedBooks = await db.all('SELECT * FROM user_books WHERE user_id = ? AND updated_at > ?', [other.id, since]);
        for (const ub of changedBooks) {
          const book = await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]);
          let message;
          if (ub.status === 'lido' && ub.review_text) message = `${other.name} escreveu uma carta sobre "${book?.title || 'um livro'}"`;
          else if (ub.status === 'lido') message = `${other.name} terminou "${book?.title || 'um livro'}"`;
          else if (ub.status === 'lendo') message = `${other.name} atualizou o progresso em "${book?.title || 'um livro'}" (página ${ub.current_page})`;
          else message = `${other.name} atualizou "${book?.title || 'um livro'}"`;
          events.push({ at: ub.updated_at, message, bookId: ub.book_id });
        }
      }

      events.sort((a, b) => new Date(b.at) - new Date(a.at));
      const latest = events[0] || null;
      return sendJson(res, 200, { hasNew: events.length > 0, since, latest });
    }

    // ---------- TOGETHER (leitura em conjunto) ----------
    if (pathname === '/api/together' && method === 'GET') {
      const rows = await db.all("SELECT * FROM user_books WHERE status = 'lendo'");
      const byBook = {};
      for (const r of rows) {
        byBook[r.book_id] = byBook[r.book_id] || [];
        byBook[r.book_id].push(r);
      }
      const together = await Promise.all(
        Object.entries(byBook).filter(([, arr]) => arr.length > 1).map(async ([bookId, arr]) => {
          const book = await db.get('SELECT * FROM books WHERE id = ?', [bookId]);
          const readers = await Promise.all(arr.map(async (r) => {
            const u = await db.get('SELECT * FROM users WHERE id = ?', [r.user_id]);
            return { user: publicUser(u), user_book: r };
          }));
          return { book, readers };
        }),
      );
      return sendJson(res, 200, { together });
    }

    return sendJson(res, 404, { error: 'rota não encontrada' });
  } catch (e) {
    console.error(e);
    return sendJson(res, 500, { error: 'erro interno', details: String(e.message || e) });
  }
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`📚 Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao iniciar o banco de dados:', err);
    process.exit(1);
  });
