// adicionar-carta-destinado.js — adiciona, na resenha do livro "Destinado" (Carina Rissi)
// no perfil da Bia, a carta de verdade que ela escreveu (vinda do Canva "Diário de Leitura").
//
// Só mexe no campo de resenha/carta (texto, trecho destacado e página) desse livro específico.
// Não toca em nota, status, datas, diário ou qualquer outra coisa. Se já existir uma carta
// escrita nesse livro, o script para e avisa, pra não sobrescrever algo que a Bia já escreveu.
//
// Uso local:  node adicionar-carta-destinado.js
// Uso na nuvem (Turso): TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node adicionar-carta-destinado.js

import db, { initDb } from './db.js';

const nowIso = () => new Date().toISOString();

function normTitle(title) {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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

// Texto da carta exatamente como a Bia escreveu, na página do Canva.
const CARTA_TEXTO = `Hoje, dia 21 de novembro de 2022, terminei de ler o primeiro livro do box Perdida. Que incrível! Confesso que estava meio insegura, mas eu simplesmente amei. A história da viagem no tempo é sensacional, e eu achei fascinante. Tem muito romance, e eu quero muito um Ian na minha vida! Ele é tão romântico... claro que não gostaria que ele fosse mais novo, mas ele é incrível.

Quero ressaltar algumas páginas:`;
const CARTA_QUOTE = 'Vou explicar melhor, querida. Imagine que todas as pessoas têm um outro núcleo e que, algumas vezes, passam por ela sem nem mesmo notar. Outras pessoas são mais atentas e as notam, têm a chance de escolher e podem ser felizes por toda a vida.';
const CARTA_PAGINA = 337;

async function run() {
  await initDb();
  console.log('💌 Adicionando a carta do "Destinado" no perfil da Bia...\n');

  const bia = await encontrarPerfilDaBia();
  if (!bia) {
    console.error('Não encontrei o perfil da Bia. Nada foi alterado.');
    process.exit(1);
  }
  console.log(`👤 Perfil encontrado: "${bia.name}" (@${bia.username})`);

  const target = normTitle('Destinado');
  const books = await db.all('SELECT * FROM books');
  const book = books.find((b) => normTitle(b.title) === target);
  if (!book) {
    console.error('Não achei o livro "Destinado" na estante. Rode primeiro o "Corrigir notas da Bia.command".');
    process.exit(1);
  }

  const ub = await db.get('SELECT * FROM user_books WHERE user_id = ? AND book_id = ?', [bia.id, book.id]);
  if (!ub) {
    console.error('A Bia ainda não tem esse livro na estante dela. Rode primeiro o "Corrigir notas da Bia.command".');
    process.exit(1);
  }

  if (ub.review_text && ub.review_text.trim()) {
    console.log('⏭️  Esse livro já tem uma resenha/carta escrita — não fui mexer pra não sobrescrever nada.');
    console.log('   Se quiser trocar mesmo assim, apague a resenha pelo app primeiro e rode este script de novo.');
    process.exit(0);
  }

  await db.run(
    `UPDATE user_books SET review_text = ?, review_quote = ?, review_page = ?, review_public = 1, updated_at = ? WHERE id = ?`,
    [CARTA_TEXTO, CARTA_QUOTE, CARTA_PAGINA, nowIso(), ub.id],
  );

  console.log('\n🎉 Pronto! A carta já está na página do livro "Destinado", no perfil da Bia (visível pra vocês duas).');
}

run().catch((err) => {
  console.error('Deu erro:', err);
  process.exit(1);
});
