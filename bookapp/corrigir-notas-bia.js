// corrigir-notas-bia.js — corrige as notas/anos/status dos livros da Bia que foram
// importados sem essa informação (o import antigo só tinha os títulos). Agora temos os
// dados de verdade (do PDF "Diário de Leitura I&B - Bea.pdf"), então esse script vai
// atualizar cada user_book da Bia com a nota, o status e o ano certos.
//
// É seguro rodar mais de uma vez. Ele NUNCA mexe em cartas/resenhas, diário ou comentários
// — só corrige nota, status e data de término, e só em livros que ainda estão do jeito que
// vieram da importação antiga (sem nota e sem resenha escrita). Se a Bia já deu nota ou
// escreveu alguma coisa nesse livro pelo próprio app, esse script pula e avisa.
//
// Uso local:  node corrigir-notas-bia.js
// Uso na nuvem (Turso): TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node corrigir-notas-bia.js

import db, { initDb } from './db.js';
import { biaListReal } from './bia-lista-real.js';

const nowIso = () => new Date().toISOString();
function newId(prefix) {
  return prefix + '_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Normaliza um título pra comparar sem se importar com acento, maiúscula/minúscula,
// pontuação ou espaços a mais — evita criar livro duplicado por causa de detalhe bobo.
function normTitle(title) {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Título que já entrou errado na importação antiga (erro de digitação) e o título certo
// que veio no PDF — sem isso, os dois normalizam diferente e o script criaria um livro
// duplicado. Se aparecerem outros casos parecidos no futuro, é só adicionar aqui.
const ALIASES = {
  [normTitle('Encontre-se se for capaz')]: normTitle('Encontre-me se for capaz'),
};

async function findBookFuzzy(title) {
  let target = normTitle(title);
  target = ALIASES[target] || target;
  const all = await db.all('SELECT * FROM books');
  return all.find((b) => {
    const t = normTitle(b.title);
    return t === target || ALIASES[t] === target;
  }) || null;
}

async function ensureBook(title, author) {
  const existing = await findBookFuzzy(title);
  if (existing) return existing;
  const id = newId('book');
  await db.run(
    `INSERT INTO books (id, title, author, cover_url, total_pages, synopsis, isbn, source_id, created_at)
    VALUES (?, ?, ?, '', 0, '', '', '', ?)`,
    [id, title.trim(), author || '', nowIso()],
  );
  return db.get('SELECT * FROM books WHERE id = ?', [id]);
}

// Acha o perfil da Bia mesmo se o nome tiver espaço a mais, letra maiúscula diferente,
// ou se ela tiver trocado o nome de exibição (ex: pra "Bea" ou "Beatriz") em "Editar perfil".
// Se nada disso bater, pega por eliminação: o único perfil que não é a "Belle"/"Isabelle".
const APELIDOS_BIA = ['bia', 'bea', 'beatriz'];

async function encontrarPerfilDaBia() {
  const todos = await db.all('SELECT * FROM users');

  let achado = todos.find((u) => APELIDOS_BIA.includes((u.name || '').trim().toLowerCase()));
  if (achado) return achado;

  achado = todos.find((u) => APELIDOS_BIA.includes((u.username || '').trim().toLowerCase()));
  if (achado) return achado;

  achado = todos.find((u) => APELIDOS_BIA.some((apelido) => (u.name || '').trim().toLowerCase().includes(apelido)));
  if (achado) return achado;

  const outros = todos.filter((u) => {
    const n = (u.name || '').trim().toLowerCase();
    const un = (u.username || '').trim().toLowerCase();
    return n !== 'belle' && un !== 'chandler' && !n.includes('isabelle') && !n.includes('belle');
  });
  if (outros.length === 1) return outros[0];

  return null;
}

async function run() {
  await initDb();
  console.log('🔧 Corrigindo notas/status/anos da Bia com os dados reais do diário dela...\n');

  const bia = await encontrarPerfilDaBia();
  if (!bia) {
    console.error('Não encontrei o perfil da Bia (tentei por nome, @usuário e por eliminação). Nada foi alterado.');
    const todos = await db.all('SELECT name, username FROM users');
    console.error('Perfis que existem nesse banco:', todos.map((u) => `${u.name} (@${u.username})`).join(', ') || '(nenhum)');
    process.exit(1);
  }
  console.log(`👤 Encontrei o perfil dela: "${bia.name}" (@${bia.username})\n`);

  let corrigidos = 0, criados = 0, pulados = 0;
  const puladosDetalhe = [];

  for (const [title, author, rating, status, year] of biaListReal) {
    const book = await ensureBook(title, author);
    const existing = await db.get('SELECT * FROM user_books WHERE user_id = ? AND book_id = ?', [bia.id, book.id]);

    const finishDate = (status === 'lido' || status === 'abandonei') && year
      ? `${year}-06-15T12:00:00.000Z`
      : null;

    if (!existing) {
      // Livro que ainda não estava na estante dela — cria já com os dados certos.
      const id = newId('ub');
      const now = nowIso();
      await db.run(
        `INSERT INTO user_books
        (id, user_id, book_id, status, current_page, start_date, finish_date, finish_date_precision, goal_date, rating, review_text, favorite, personal_comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, '', 0, '', ?, ?)`,
        [id, bia.id, book.id, status, finishDate, finishDate, finishDate ? 'year' : 'day', rating, now, now],
      );
      criados++;
      continue;
    }

    const pareceIntocado = existing.rating === null && !existing.review_text && !existing.personal_comment;
    if (!pareceIntocado) {
      pulados++;
      puladosDetalhe.push(title);
      continue;
    }

    await db.run(
      `UPDATE user_books SET status = ?, rating = ?, finish_date = COALESCE(finish_date, ?), finish_date_precision = CASE WHEN finish_date IS NULL AND ? IS NOT NULL THEN 'year' ELSE finish_date_precision END, start_date = COALESCE(start_date, ?), updated_at = ? WHERE id = ?`,
      [status, rating, finishDate, finishDate, finishDate, nowIso(), existing.id],
    );
    corrigidos++;
  }

  console.log(`✅ ${corrigidos} livro(s) corrigidos (nota, status e ano aplicados).`);
  console.log(`➕ ${criados} livro(s) novo(s) adicionados (estavam faltando na estante dela).`);
  console.log(`⏭️  ${pulados} livro(s) pulados porque a Bia já tinha dado nota ou escrito algo neles pelo app.`);
  if (puladosDetalhe.length) {
    console.log('   → ' + puladosDetalhe.join(', '));
  }
  console.log('\n🎉 Pronto! As estatísticas e o histórico da Bia agora refletem as notas reais dela.');
}

run().catch((err) => {
  console.error('Deu erro:', err);
  process.exit(1);
});
