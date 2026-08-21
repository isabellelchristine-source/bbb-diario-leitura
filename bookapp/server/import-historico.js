// import-historico.js — importa o histórico de leitura de vocês duas a partir das listas
// que a Isabelle já tinha (o diário de leitura da Belle/Isabelle com notas, e a lista da Bia).
//
// Rode com o servidor principal FECHADO (feche a janela do "Abrir BBB.command" antes).
// Pode rodar mais de uma vez: livros e leituras já importados não são duplicados.
//
// Uso local:  node import-historico.js
// Uso na nuvem (Turso): TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node import-historico.js

import db, { initDb } from './db.js';
import { hashPassword } from './auth.js';
import { biaListReal } from './bia-lista-real.js';

const nowIso = () => new Date().toISOString();
function newId(prefix) {
  return prefix + '_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// ---------------------------------------------------------------------------
// Lista da Belle (Isabelle) — com nota (0-5) e status, extraída do diário de leitura
// ---------------------------------------------------------------------------
const belleList = [
  ['Diário de uma garota nada popular 4', 'Rachel Renée Russell', 2, 'lido'],
  ['Diário de uma garota nada popular 2', 'Rachel Renée Russell', 2, 'lido'],
  ['De amor e amizade', 'Clarice Lispector', 3, 'lido'],
  ['Nem todo amor tem um final feliz e tá tudo bem', 'Felipe Rocha', 3, 'lido'],
  ['Quebre abrir o seu sapatinho de cristal', 'Amanda Lovelace', 3, 'lido'],
  ['Desculpe o exagero mas não sei sentir pouco', 'Geffo Pinheiro', 4, 'lido'],
  ['Faça sua coroa de gelo brilhar', 'Amanda Lovelace', 4, 'lido'],
  ['A bruxa não vai para a fogueira nesse livro', 'Amanda Lovelace', 4, 'lido'],
  ['Céu sem estrela', 'Iris Figueiredo', 2, 'lido'],
  ['A voz da sereia a voz nesse livro', 'Amanda Lovelace', 4, 'lido'],
  ['Louca por você', 'A. C. Meyer', 4, 'lido'],
  ['Talvez a sua jornada agora seja só sobre você', 'Iandê Albuquerque', 4, 'lido'],
  ['O que o sol faz com as flores', 'Rupi Kaur', 3, 'lido'],
  ['Outro jeito de usar a boca', 'Rupi Kaur', 3, 'lido'],
  ['Todas as coisas que eu te escreveria se pudesse', 'Igor Pires', 4, 'lido'],
  ['As coisas que você só vê quando desacelera', 'Haemin Sunim', 5, 'lido'],
  ['Fazendo meu filme', 'Paula Pimenta', 2, 'lido'],
  ['Confissão', 'Paula Pimenta', 5, 'lido'],
  ['Um ano inesquecível', 'Paula Pimenta, Babi Dewet, Bruna Vieira, Thalita Rebouças', 4, 'lido'],
  ['Princesa das águas', 'Paula Pimenta', 4, 'lido'],
  ['Cinderela pop', 'Paula Pimenta', 4, 'lido'],
  ['Princesa adormecida', 'Paula Pimenta', 4, 'lido'],
  ['Fazendo meu filme 4', 'Paula Pimenta', 4, 'lido'],
  ['Fazendo meu filme 3', 'Paula Pimenta', 4, 'lido'],
  ['Fazendo meu filme 2', 'Paula Pimenta', 4, 'lido'],
  ['Para todas as pessoas intensas', 'Iandê Albuquerque', 3, 'lido'],
  ['Textos cruéis demais', 'Igor Pires', 4, 'lido'],
  ['Textos cruéis demais para serem lidos rapidamente onde Dorme o amor', 'Igor Pires', 4, 'lido'],
  ['Ter seus cruéis demais parecerem lidos rapidamente', 'Igor Pires', 3, 'lido'],
  ['Gossip girl', 'Cecily von Ziegesar', 5, 'lido'],
  ['A culpa das estrelas', 'John Green', 5, 'lido'],
  ['Eu sou Malala', 'Malala Yousafzai', 4, 'lido'],
  ['Carta de amor aos mortos', 'Ava Dellaira', 5, 'lido'],
  ['Coroa cruel', 'Victoria Aveyard', 3, 'lido'],
  ['Espada de vidro', 'Victoria Aveyard', 3, 'lido'],
  ['Fala sério mãe', 'Thalita Rebouças', 3, 'lido'],
  ['De volta ao sonhos', 'Bruna Vieira', 3, 'lido'],
  ['Minha vida é Fora de série 1', 'Paula Pimenta', 3, 'lido'],
  ['Minha vida é fora de série 2', 'Paula Pimenta', 3, 'lido'],
  ['Memórias póstumas de Brás Cuba', 'Machado de Assis', 3, 'lido'],
  ['O homem de giz', 'C.J. Tudor', 3, 'lido'],
  ['O vendedor de sonhos', 'Augusto Cury', 5, 'lido', 2008],
  ['A depressão é uma borboleta azul', 'Sabrina A.', 4, 'abandonei', 2017],
  ['Os segredos da mente milionária', 'T. Harv Eker', 4, 'lido', 2025],
  ['1984', 'George Orwell', 5, 'lido', 2025],
  ['Outras coisas que guardei pra mim', 'Samara Azevedo', 5, 'lido', 2019],
  ['Fascismo e democracia', 'George Orwell', 5, 'lido', 2025],
  ['O manifesto comunista', 'Karl Marx & Friedrich Engels', 5, 'lido', 2025],
  ['Jantar secreto', 'Raphael Montes', 4, 'lido', 2025],
  ['Suicidas', 'Raphael Montes', 5, 'lido', 2025],
  ['Layla', 'Colleen Hoover', 4, 'lido', 2025],
  ['O massacre da família hope', 'Riley Sager', 0, 'lido', 2025],
  ['A empregada', 'Freida McFadden', 5, 'lido', 2025],
  ['Um caso perdido', 'Colleen Hoover', 3, 'lido', 2025],
  ['Os sete maridos de Evelyn Hugo', 'Taylor Jenkins Reid', 5, 'lido', 2025],
  ['A paciente silenciosa', 'Alex Michaelides', 5, 'lido', 2025],
  ['É assim que acaba', 'Colleen Hoover', 5, 'lido', 2025],
  ['Verity', 'Colleen Hoover', 5, 'lido', 2025],
  ['PS ainda amo você', 'Jenny Han', 3, 'lido'],
  ['A revolução dos bichos', 'George Orwell', 5, 'lido'],
  ['Coisas que guardei pra mim', 'Samara Azevedo', 3, 'lido'],
  ['Coraline', 'Neil Gaiman', 5, 'lido', 2024],
  ['O Colecionador', 'John Fowles', 5, 'lido', 2023],
  ['O Orfanato da Srta. Peregrine para Crianças Peculiares', 'Ransom Riggs', 4, 'lido'],
  ['Para todos os garotos que já amei', 'Jenny Han', 3, 'lido'],
  ['Os contos de Beedle o Bardo', 'J.K. Rowling', 3, 'lido'],
  ['A herdeira', 'Kiera Cass', 3, 'lido'],
  ['Por lugares incríveis', 'Jennifer Niven', 4, 'lido'],
  ['A escolha', 'Kiera Cass', 4, 'lido'],
  ['A elite', 'Kiera Cass', 5, 'lido'],
  ['O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 5, 'lido', 2023],
  ['A rainha vermelha', 'Victoria Aveyard', 3, 'lido'],
  ['A biblioteca da meia-noite', 'Matt Haig', 3, 'lido', 2025],
  ['A seleção', 'Kiera Cass', 5, 'lido'],
  ['Nunca Minta', 'Freida McFadden', 3, 'lido', 2026],
  ['Do Socialismo Utópico ao Socialismo Científico', 'Friedrich Engels', 4, 'lido', 2026],
  ['Pedra Papel Tesoura', 'Alice Feeney', 4, 'lido', 2026],
  ['A Intrusa', 'Freida McFadden', 3, 'lido', 2026],
  ['A psicologia do Sonho', 'Sigmund Freud', 2, 'abandonei', 2026],
  ['O Namorado', 'Freida McFadden', 4, 'lido', 2026],
  ['Crônicas para Jovens: De Amor e Amizade', 'Clarice Lispector', 3, 'lido'],
  ['A Última Carta', 'Rebecca Yarros', null, 'lendo', 2026],
];

// ---------------------------------------------------------------------------
// Lista da Bia — vem de bia-lista-real.js, com nota, ano e status de verdade
// (extraída do diário de leitura dela). Se um dia for preciso reimportar do zero,
// já entra tudo certo, sem precisar rodar corrigir-notas-bia.js depois.
// ---------------------------------------------------------------------------

async function ensureUser(name, username, plainPassword, bio) {
  let user = await db.get('SELECT * FROM users WHERE name = ? COLLATE NOCASE', [name]);
  if (user) return { user, created: false };
  const { hash, salt } = hashPassword(plainPassword);
  const id = newId('user');
  const colors = ['#C9A9E9', '#F4B6C2', '#9AD1D4', '#F1B94B', '#8FBFAE'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  await db.run(
    `INSERT INTO users (id, name, username, bio, avatar_color, avatar_url, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, username, bio || '', color, '', hash, salt, nowIso()],
  );
  user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  return { user, created: true, tempPassword: plainPassword };
}

async function ensureBookByTitle(title, author) {
  const norm = title.trim();
  let book = await db.get('SELECT * FROM books WHERE title = ? COLLATE NOCASE', [norm]);
  if (book) return book;
  const id = newId('book');
  await db.run(
    `INSERT INTO books (id, title, author, cover_url, total_pages, synopsis, isbn, source_id, created_at)
    VALUES (?, ?, ?, '', 0, '', '', '', ?)`,
    [id, norm, author || '', nowIso()],
  );
  return db.get('SELECT * FROM books WHERE id = ?', [id]);
}

async function upsertUserBook(userId, bookId, { status, rating, finishYear }) {
  const existing = await db.get('SELECT * FROM user_books WHERE user_id = ? AND book_id = ?', [userId, bookId]);
  if (existing) {
    return { updated: false, skipped: true };
  }
  const now = nowIso();
  // Só preenchemos a data de término quando sabemos o ano de verdade — assim livros
  // antigos sem data não entram por engano nas estatísticas de "lido este ano".
  const finishDate = (status === 'lido' || status === 'abandonei') && finishYear
    ? `${finishYear}-06-15T12:00:00.000Z`
    : null;
  const startDate = finishDate;
  const id = newId('ub');
  await db.run(
    `INSERT INTO user_books
    (id, user_id, book_id, status, current_page, start_date, finish_date, finish_date_precision, goal_date, rating, review_text, favorite, personal_comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, '', 0, '', ?, ?)`,
    [id, userId, bookId, status, startDate, finishDate, finishDate ? 'year' : 'day', rating, now, now],
  );
  return { updated: true, skipped: false };
}

async function run() {
  await initDb();
  console.log('📚 Importando histórico de leitura...\n');

  const belle = await ensureUser('Belle', 'chandler', 'trocarSenha123', 'lendo o ano todo ✨');
  console.log(belle.created
    ? `👤 Perfil "Belle" criado agora (username: chandler, senha temporária: ${belle.tempPassword})`
    : `👤 Perfil "Belle" já existia (username: ${belle.user.username}) — usando ele`);

  const bia = await ensureUser('Bia', 'bia', 'trocarSenha123', 'suspense sempre 👀');
  console.log(bia.created
    ? `👤 Perfil "Bia" criado agora (username: bia, senha temporária: ${bia.tempPassword})`
    : `👤 Perfil "Bia" já existia (username: ${bia.user.username}) — usando ele`);

  console.log('\n--- Importando lista da Belle (com notas) ---');
  let belleAdded = 0, belleSkipped = 0;
  for (const row of belleList) {
    const [title, author, rating, status, year] = row;
    const book = await ensureBookByTitle(title, author);
    const result = await upsertUserBook(belle.user.id, book.id, {
      status, rating, finishYear: year, isCurrentlyReading: status === 'lendo',
    });
    if (result.updated) belleAdded++; else belleSkipped++;
  }
  console.log(`✅ ${belleAdded} livro(s) adicionados para Belle, ${belleSkipped} já existiam (pulados).`);

  console.log('\n--- Importando lista da Bia (com notas, anos e status reais) ---');
  let biaAdded = 0, biaSkipped = 0;
  for (const row of biaListReal) {
    const [title, author, rating, status, year] = row;
    const book = await ensureBookByTitle(title, author);
    const result = await upsertUserBook(bia.user.id, book.id, { status, rating, finishYear: year });
    if (result.updated) biaAdded++; else biaSkipped++;
  }
  console.log(`✅ ${biaAdded} livro(s) adicionados para Bia, ${biaSkipped} já existiam (pulados).`);

  // Marca a importação como "já vista" pelas duas, pra não disparar uma notificação
  // de "novidade" por causa só do histórico que acabou de entrar.
  const seenAt = nowIso();
  await db.run('UPDATE users SET last_seen_at = ? WHERE id IN (?, ?)', [seenAt, belle.user.id, bia.user.id]);

  console.log('\n🎉 Importação concluída! Já pode abrir o BBB normalmente.');
}

run().catch((err) => {
  console.error('Deu erro na importação:', err);
  process.exit(1);
});
