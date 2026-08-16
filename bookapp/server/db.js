// db.js — camada de dados usando @libsql/client.
// Localmente (sem variáveis de ambiente extras) grava num arquivo SQLite comum.
// Em produção, defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN pra usar o banco na nuvem (Turso) —
// o mesmo código funciona nos dois casos, só muda pra onde ele aponta.
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let client;
if (process.env.TURSO_DATABASE_URL) {
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
} else {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  client = createClient({ url: `file:${path.join(dataDir, 'bookapp.db')}` });
}

// Converte as linhas devolvidas pelo libSQL (que vêm num formato meio especial)
// em objetos JS comuns, do jeito que o resto do app espera.
function toPlainRows(resultSet) {
  return resultSet.rows.map((row) => {
    const obj = {};
    for (const col of resultSet.columns) obj[col] = row[col];
    return obj;
  });
}

export const db = {
  async get(sql, args = []) {
    const result = await client.execute({ sql, args });
    const rows = toPlainRows(result);
    return rows[0];
  },
  async all(sql, args = []) {
    const result = await client.execute({ sql, args });
    return toPlainRows(result);
  },
  async run(sql, args = []) {
    const result = await client.execute({ sql, args });
    return { lastInsertRowid: result.lastInsertRowid, rowsAffected: result.rowsAffected };
  },
  async exec(sql) {
    // várias instruções separadas por ; — roda uma por vez.
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.execute(statement);
    }
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  bio TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#C9A9E9',
  avatar_url TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  last_seen_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  total_pages INTEGER DEFAULT 0,
  synopsis TEXT DEFAULT '',
  isbn TEXT DEFAULT '',
  source_id TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quero_ler',
  current_page INTEGER DEFAULT 0,
  start_date TEXT,
  finish_date TEXT,
  goal_date TEXT,
  rating REAL,
  review_text TEXT DEFAULT '',
  favorite INTEGER DEFAULT 0,
  personal_comment TEXT DEFAULT '',
  review_public INTEGER DEFAULT 1,
  review_page INTEGER,
  review_quote TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(book_id) REFERENCES books(id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_book_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  page INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_book_id) REFERENCES user_books(id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(journal_id, user_id, emoji),
  FOREIGN KEY(journal_id) REFERENCES journal_entries(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(journal_id) REFERENCES journal_entries(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  target_books INTEGER NOT NULL,
  UNIQUE(user_id, year),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

async function ensureColumn(table, column, definition) {
  const existing = await db.all(`PRAGMA table_info(${table})`);
  const has = existing.some((c) => c.name === column);
  if (!has) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function initDb() {
  await db.exec(SCHEMA);

  // Migração leve pra bancos que já existiam antes dessas colunas.
  await ensureColumn('user_books', 'review_public', 'INTEGER DEFAULT 1');
  await ensureColumn('user_books', 'review_page', 'INTEGER');
  await ensureColumn('user_books', 'review_quote', "TEXT DEFAULT ''");
  await ensureColumn('users', 'last_seen_at', 'TEXT');

  await db.run('UPDATE users SET last_seen_at = ? WHERE last_seen_at IS NULL', [new Date().toISOString()]);
}

export default db;
