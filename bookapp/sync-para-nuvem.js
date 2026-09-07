// sync-para-nuvem.js — copia TUDO que já está no seu banco local (server/data/bookapp.db)
// pro banco na nuvem (Turso), sobrescrevendo o que já estiver lá com a versão mais atual
// que você tem no computador. Use isso sempre que tiver mexido no app local e quiser que
// a versão publicada (Render) fique igualzinha.
//
// Uso: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node sync-para-nuvem.js

import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('Faltam as variáveis TURSO_DATABASE_URL e TURSO_AUTH_TOKEN. Cole os dois valores do Turso antes do comando.');
  process.exit(1);
}

const localPath = path.join(__dirname, 'data', 'bookapp.db');
if (!fs.existsSync(localPath)) {
  console.error(`Não achei o banco local em ${localPath}. Rode isso na mesma pasta "server" de sempre.`);
  process.exit(1);
}

const local = createClient({ url: `file:${localPath}` });
const cloud = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Garante que a nuvem tem as mesmas tabelas (se for um banco novo/vazio).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, bio TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#C9A9E9', avatar_url TEXT DEFAULT '', password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL, last_seen_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT DEFAULT '', cover_url TEXT DEFAULT '',
  total_pages INTEGER DEFAULT 0, synopsis TEXT DEFAULT '', isbn TEXT DEFAULT '', source_id TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_books (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, book_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'quero_ler',
  current_page INTEGER DEFAULT 0, start_date TEXT, finish_date TEXT, goal_date TEXT, rating REAL,
  review_text TEXT DEFAULT '', favorite INTEGER DEFAULT 0, personal_comment TEXT DEFAULT '',
  review_public INTEGER DEFAULT 1, review_page INTEGER, review_quote TEXT DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY, user_book_id TEXT NOT NULL, user_id TEXT NOT NULL, text TEXT NOT NULL,
  emoji TEXT DEFAULT '', page INTEGER DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY, journal_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(journal_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, journal_id TEXT NOT NULL, user_id TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, year INTEGER NOT NULL, target_books INTEGER NOT NULL, UNIQUE(user_id, year)
);
`;

function toPlainRows(resultSet) {
  return resultSet.rows.map((row) => {
    const obj = {};
    for (const col of resultSet.columns) obj[col] = row[col];
    return obj;
  });
}

async function copyTable(table, columns) {
  const result = await local.execute(`SELECT * FROM ${table}`);
  const rows = toPlainRows(result);
  const placeholders = columns.map(() => '?').join(', ');
  for (const row of rows) {
    const values = columns.map((c) => row[c] ?? null);
    await cloud.execute({
      sql: `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      args: values,
    });
  }
  console.log(`✅ ${table}: ${rows.length} linha(s) enviada(s).`);
}

async function run() {
  console.log('☁️  Enviando os dados do seu computador pra nuvem...\n');

  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await cloud.execute(stmt);
  }

  // Limpa tudo que já estava na nuvem antes de copiar — evita conflito de IDs entre
  // o que foi importado antes e o que existe no seu computador agora. O computador
  // manda, sempre (é o mais atualizado).
  console.log('Limpando dados antigos da nuvem antes de copiar os novos...');
  await cloud.execute('PRAGMA foreign_keys = OFF');
  for (const t of ['comments', 'reactions', 'journal_entries', 'user_books', 'goals', 'sessions', 'books', 'users']) {
    await cloud.execute(`DELETE FROM ${t}`);
  }

  await copyTable('users', ['id', 'name', 'username', 'bio', 'avatar_color', 'avatar_url', 'password_hash', 'password_salt', 'last_seen_at', 'created_at']);
  await copyTable('books', ['id', 'title', 'author', 'cover_url', 'total_pages', 'synopsis', 'isbn', 'source_id', 'created_at']);
  await copyTable('user_books', ['id', 'user_id', 'book_id', 'status', 'current_page', 'start_date', 'finish_date', 'goal_date', 'rating', 'review_text', 'favorite', 'personal_comment', 'review_public', 'review_page', 'review_quote', 'created_at', 'updated_at']);
  await copyTable('journal_entries', ['id', 'user_book_id', 'user_id', 'text', 'emoji', 'page', 'created_at']);
  await copyTable('reactions', ['id', 'journal_id', 'user_id', 'emoji', 'created_at']);
  await copyTable('comments', ['id', 'journal_id', 'user_id', 'text', 'created_at']);
  await copyTable('goals', ['id', 'user_id', 'year', 'target_books']);

  console.log('\n🎉 Pronto! O site publicado agora tem os mesmos dados do seu computador — inclusive sua senha de verdade.');
}

run().catch((err) => {
  console.error('Deu erro:', err);
  process.exit(1);
});
