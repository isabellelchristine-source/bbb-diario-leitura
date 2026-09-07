import crypto from 'node:crypto';

export function newId(prefix = '') {
  return (prefix ? prefix + '_' : '') + crypto.randomBytes(12).toString('hex');
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

export function getToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function nowIso() {
  return new Date().toISOString();
}

// Esconde o conteúdo da "carta" (resenha) de quem não é dona do livro, quando ela
// marcou a resenha como privada. Nota e favorito continuam visíveis sempre.
export function redactReview(ub, viewerId) {
  if (!ub) return ub;
  const isOwner = viewerId && ub.user_id === viewerId;
  if (isOwner || ub.review_public === undefined || ub.review_public === null || ub.review_public) {
    return ub;
  }
  return { ...ub, review_text: '', review_quote: '', review_page: null, review_style: '', review_hidden: true };
}
