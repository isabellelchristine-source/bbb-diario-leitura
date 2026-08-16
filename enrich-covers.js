// enrich-covers.js — tenta buscar capa + total de páginas pra livros que ainda não têm,
// usando Google Books e Open Library (nessa ordem). Rode com o servidor principal FECHADO.
//
// Uso local:  node enrich-covers.js
// Uso na nuvem (Turso): TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node enrich-covers.js

import db, { initDb } from './db.js';
import { findBestCover } from './bookSources.js';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  await initDb();
  const books = await db.all("SELECT * FROM books WHERE cover_url = '' OR cover_url IS NULL");
  console.log(`📚 ${books.length} livro(s) sem capa. Buscando...\n`);

  if (books.length === 0) {
    console.log('Nada para fazer — todos os livros já têm capa. 🎉');
    return;
  }

  let found = 0, notFound = 0;
  for (const [i, book] of books.entries()) {
    process.stdout.write(`(${i + 1}/${books.length}) ${book.title}... `);
    const result = await findBestCover(book.title, book.author);
    if (result && (result.cover_url || result.total_pages)) {
      await db.run(
        `UPDATE books SET cover_url = COALESCE(NULLIF(?, ''), cover_url), total_pages = CASE WHEN total_pages = 0 THEN ? ELSE total_pages END, synopsis = COALESCE(NULLIF(?, ''), synopsis) WHERE id = ?`,
        [result.cover_url || '', result.total_pages || 0, result.synopsis || '', book.id],
      );
      console.log(result.cover_url ? '✅ capa encontrada' : '➕ dados encontrados (sem capa)');
      found++;
    } else {
      console.log('— não encontrado');
      notFound++;
    }
    await sleep(250); // educado com as APIs públicas
  }

  console.log(`\n🎉 Pronto! ${found} livro(s) atualizados, ${notFound} não encontrados (cadastre a capa manualmente pela página do livro, se quiser).`);
}

run().catch((err) => {
  console.error('Deu erro:', err);
  process.exit(1);
});
