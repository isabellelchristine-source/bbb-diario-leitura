import db from './db.js';

async function joinBook(ub) {
  const book = await db.get('SELECT * FROM books WHERE id = ?', [ub.book_id]);
  return { ...ub, book };
}

export async function getUserBooks(userId, status) {
  let rows;
  if (status) {
    rows = await db.all('SELECT * FROM user_books WHERE user_id = ? AND status = ? ORDER BY updated_at DESC', [userId, status]);
  } else {
    rows = await db.all('SELECT * FROM user_books WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  }
  return Promise.all(rows.map(joinBook));
}

export async function computeStats(userId) {
  const all = await getUserBooks(userId);
  const year = new Date().getFullYear();

  const read = all.filter((b) => b.status === 'lido');
  const reading = all.filter((b) => b.status === 'lendo');
  const want = all.filter((b) => b.status === 'quero_ler');
  const paused = all.filter((b) => b.status === 'pausado');
  const abandoned = all.filter((b) => b.status === 'abandonei');

  const rated = read.filter((b) => b.rating != null);
  const avgRating = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : null;

  const bestBook = rated.length ? rated.reduce((a, b) => (b.rating > a.rating ? b : a)) : null;
  const worstBook = rated.length ? rated.reduce((a, b) => (b.rating < a.rating ? b : a)) : null;

  const readThisYear = read.filter((b) => b.finish_date && new Date(b.finish_date).getFullYear() === year);
  const totalPagesRead = read.reduce((s, b) => s + (b.book?.total_pages || 0), 0)
    + reading.reduce((s, b) => s + (b.current_page || 0), 0);
  const pagesThisYear = readThisYear.reduce((s, b) => s + (b.book?.total_pages || 0), 0);

  const goalRow = await db.get('SELECT * FROM goals WHERE user_id = ? AND year = ?', [userId, year]);

  return {
    total_read: read.length,
    total_reading: reading.length,
    total_want: want.length,
    total_paused: paused.length,
    total_abandoned: abandoned.length,
    avg_rating: avgRating,
    best_book: bestBook,
    worst_book: worstBook,
    books_read_this_year: readThisYear.length,
    pages_read_this_year: pagesThisYear,
    total_pages_read: totalPagesRead,
    goal: goalRow ? { year, target_books: goalRow.target_books, progress: readThisYear.length } : null,
  };
}

export async function currentlyReading(userId) {
  const rows = await db.all("SELECT * FROM user_books WHERE user_id = ? AND status = 'lendo' ORDER BY updated_at DESC", [userId]);
  return Promise.all(rows.map(joinBook));
}
