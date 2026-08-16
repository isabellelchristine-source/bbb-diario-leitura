// bookSources.js — busca de metadados de livros em APIs públicas (sem chave de API).
// Usado tanto pela busca ao vivo (server.js) quanto pelo script de enriquecer capas.

async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGoogleBooks(q) {
  const resp = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20`);
  if (!resp.ok) throw new Error('google books indisponível');
  const data = await resp.json();
  return (data.items || []).map((item) => {
    const info = item.volumeInfo || {};
    return {
      source_id: item.id,
      title: info.title || 'Sem título',
      author: (info.authors || []).join(', '),
      cover_url: info.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
      total_pages: info.pageCount || 0,
      synopsis: info.description || '',
      isbn: (info.industryIdentifiers || []).find((i) => i.type === 'ISBN_13')?.identifier
        || (info.industryIdentifiers || [])[0]?.identifier || '',
    };
  });
}

export async function searchOpenLibrary(q) {
  const resp = await fetchWithTimeout(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn`);
  if (!resp.ok) throw new Error('open library indisponível');
  const data = await resp.json();
  return (data.docs || []).map((doc) => ({
    source_id: doc.key,
    title: doc.title || 'Sem título',
    author: (doc.author_name || []).join(', '),
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    total_pages: doc.number_of_pages_median || 0,
    synopsis: '',
    isbn: (doc.isbn || [])[0] || '',
  }));
}

// Tenta achar 1 resultado bom pra um livro específico (usado no enriquecimento em lote).
export async function findBestCover(title, author) {
  const q = author ? `${title} ${author}` : title;
  try {
    const results = await searchGoogleBooks(q);
    if (results[0]) return results[0];
  } catch (e) { /* segue pro próximo */ }
  try {
    const results = await searchOpenLibrary(q);
    if (results[0]) return results[0];
  } catch (e) { /* sem sorte */ }
  return null;
}
