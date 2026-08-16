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
// Lista da Bia — livros já lidos, sem nota registrada
// ---------------------------------------------------------------------------
const biaList = [
  'A ilha perdida', 'Amor pelos bichinhos', 'Dormindo fora',
  'Diário de uma garota nada popular 2', 'Diário de uma garota nada popular 3',
  'Diário de uma garota nada popular 4', 'Diário de uma garota nada popular 5',
  'Caçadora de estrelas', 'A cinco passos de você', 'Céu sem estrelas',
  'Todas as suas imperfeições', 'O pequeno príncipe', 'Para todos os garotos que já amei',
  'Ps: Ainda amo você', 'Agora e para sempre Lara Jean', 'O fim em doses homeopáticas',
  'A seleção', 'A elite', 'A escolha', 'Felizes para sempre', 'A herdeira', 'A coroa',
  'Todo esse tempo', 'O invisível aos olhos', 'Cartas de amor aos mortos',
  'Por lugares incríveis', 'Menina feita de estrelas', 'Mil beijos de garoto',
  'A última carta de amor', 'Mr. Romance', 'É assim que acaba',
  'Os sete maridos de Evelyn Hugo', 'Até o verão terminar', 'Verity',
  'Não nasci para agradar', 'Clube do livro dos homens', 'Missão romance',
  'Como eu era antes de você', 'Depois de você', 'Ainda sou eu', 'Perdida', 'Encontrada',
  'Destinado', 'Cinquenta tons de cinza', 'Cinquenta tons de cinza mais escuro',
  'Cinquenta tons de liberdade', 'Sempre teremos o verão', 'Grey', 'Mais escuro',
  'Prometida', 'Desencantada', 'Indomada', '13 segundos', 'O verão que mudou minha vida',
  'Sem você não é verão', 'Livre', 'A rainha vermelha', 'Professor feelgood',
  'Novembro 9', 'Eu e esse meu coração', 'A razão do amor', 'As mil partes do meu coração',
  'As coisas que nunca superamos', 'A biblioteca da meia-noite', 'Talvez um dia',
  'Talvez agora', 'Dr. Love', 'Um caso perdido', 'Sem esperança',
  'Em busca de Cinderela - Em busca da perfeição', 'Tarde demais', 'Meu Romeu',
  'Amor entrelinhas', 'Espada de vidro', 'Como parar o tempo',
  'Termos e condições para o amor', 'Estupidamente apaixonados', 'Absolutamente Romântico',
  'Teto para dois', 'Se eu fica', 'Uma segunda chance', 'É assim que começa', 'A babá',
  'Amor, teoricamente', 'Sr. Daniels', 'As coisas que guardamos em segredo',
  'Três chances para o amor', 'Amor corrompido', 'Jogos do amor', 'Amor e ódio',
  'O lado feio do amor', 'Lutando contra o luto', 'Oferta final para o amor',
  'O corpo fala', 'Minha Julieta', 'Coração perverso', 'Histórias de Meu Romeu',
  'O princípio do amor', 'Lance para o amor', 'Lance para a atração', 'Lance para a paixão',
  'Faça um pedido', 'Eu pediria por você', 'Depois de vegas', 'Filha da máfia: O acordo',
  'Incipit', 'Aluguei um bilionário', 'Vivendo com o inimigo', 'O noivo ideal',
  'Sob o poder do passado', 'Proibida', 'Os segredos da mente milionária', 'Friendzone',
  'Coragem', 'Tempestades do sul', 'O milagre da manhã para se tornar um milionário',
  'Poesias para me sentir viva', 'Luzes do leste', 'Pai rico Pai pobre',
  'Estrelas do norte', 'Mentiras do amor', 'As coisas que deixamos para trás',
  'A hipótese do amor', 'Métrica', 'Pausa', 'Essa garota', 'Sem defeitos', 'Sem coração',
  'Sem controle', 'Layla', 'O massacre da família Hope', 'Rei da ira', 'Pense de novo',
  'Rei do orgulho', 'Rei da ganância', 'Rei da preguiça', 'Duas versões de você',
  'Usada e grávida do chefe da máfia', 'Te protejo em segredo', 'Maneiras de te odiar',
  'Collapse', 'Além das cicatrizes', 'Mr. Hockey', 'Até você ser minha',
  'Antes que me deixe', 'Encontre-se se for capaz', 'Pole Position', 'Querido, vizinho',
  'Feita pra mim', 'Minha melhor parte', 'A voz de Archer', 'Divinos rivais',
  'A menina que roubava livros', 'O teorema Katherine', 'O conto da aia',
  'O morro dos ventos uivantes', 'O que o sol faz com as flores', 'Outro jeito de usar a boca',
  'Textos cruéis demais para serem lidos rapidamente',
  'Textos cruéis demais para serem lidos rapidamente onde mora o amor',
  'A princesa salva a si mesma neste livro', 'A bruxa não vai para a fogueira neste livro',
  'A voz da sereia volta neste livro', 'Para todas as pessoas intensas',
  'Pra você que teve um dia ruim', 'Todas as flores que não te enviei',
  'Nem todo amor tem um final feliz e tá tudo bem', 'Tudo nela brilha e queima',
  'Para todas as pessoas apaixonantes', 'Quebre os seus sapatinhos de cristal',
  'Faça a sua coroa de gelo brilhar', 'Cidade de Papel', 'A culpa é das estrelas',
  'Para onde ela foi', 'Eu perdi o rumo', 'Um ano inesquecível',
  'Palavras em azul profundo', 'Um milhão de finais felizes',
  'O reino das vozes que não se calam', 'O mundo das vozes silenciadas',
  'A princesa adormecida', 'Cinderela pop', 'Princesa das águas', 'Extraordinário',
  'O milagre', 'O resgate', 'O guardião', 'Puro impulso', 'Orgulho e preconceito',
  'Razão e sentimento', 'Puro impacto', 'A última carta', 'O namorado',
  'A trilha para o coração', 'Sem juízo', 'No fundo, é amor', 'Rei da inveja',
];

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
    (id, user_id, book_id, status, current_page, start_date, finish_date, goal_date, rating, review_text, favorite, personal_comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, '', 0, '', ?, ?)`,
    [id, userId, bookId, status, startDate, finishDate, rating, now, now],
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

  console.log('\n--- Importando lista da Bia (sem notas, todos "Lido") ---');
  let biaAdded = 0, biaSkipped = 0;
  for (const title of biaList) {
    const book = await ensureBookByTitle(title, '');
    const result = await upsertUserBook(bia.user.id, book.id, { status: 'lido', rating: null, finishYear: null });
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
