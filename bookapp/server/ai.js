// ai.js — ajuda de IA pra escrever a carta: manda um áudio (ou texto solto) pro Gemini e
// pede pra ele organizar isso num texto de carta carinhosa, no formato "Querida [nome]...".
// Usa o endpoint compatível com OpenAI do Gemini (mais simples de interpretar a resposta
// do que a API nova "Interactions"), via fetch puro — sem precisar instalar nenhum pacote.
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const aiEnabled = Boolean(process.env.GEMINI_API_KEY);

function buildPrompt({ bookTitle, bookAuthor, recipientName, authorName }) {
  return (
    `Você vai ajudar ${authorName || 'a pessoa'} a escrever uma carta pessoal sobre o livro ` +
    `"${bookTitle || 'um livro'}"${bookAuthor ? ` (de ${bookAuthor})` : ''}, endereçada a ` +
    `${recipientName || 'uma amiga'}.\n\n` +
    `Você vai receber um áudio (ou texto) com os pensamentos soltos e desorganizados de ` +
    `${authorName || 'quem está escrevendo'} sobre o livro. Sua tarefa:\n` +
    `1. Se for áudio, transcreva o que foi dito.\n` +
    `2. Reorganize em uma carta carinhosa e pessoal, no formato "Querida ${recipientName || '[nome]'}...".\n` +
    `3. Mantenha TODAS as opiniões, sentimentos e informações ditas — não invente nada que não foi falado.\n` +
    `4. Pode corrigir gramática, juntar frases soltas e deixar mais fluido, mas sem mudar o sentido nem o tom pessoal.\n` +
    `5. Termine com uma despedida carinhosa (ex: "Com carinho,").\n` +
    `6. Responda APENAS com o texto da carta em português — nada de comentários, explicações ou aspas em volta.`
  );
}

// context: { bookTitle, bookAuthor, recipientName, authorName }
// input: { text } OU { audioBase64, format } (format: 'webm' | 'mp3' | 'wav' | 'm4a' | 'ogg' etc.)
export async function draftLetterWithAI(context, input) {
  if (!aiEnabled) throw new Error('IA não configurada — defina GEMINI_API_KEY nas variáveis de ambiente.');

  const content = [{ type: 'text', text: buildPrompt(context) }];
  if (input.audioBase64) {
    content.push({ type: 'input_audio', input_audio: { data: input.audioBase64, format: input.format || 'webm' } });
  } else if (input.text) {
    content.push({ type: 'text', text: `Pensamentos soltos:\n${input.text}` });
  } else {
    throw new Error('informe audioBase64 ou text');
  }

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini respondeu com erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('a IA não devolveu nenhum texto — tenta de novo.');
  return text.trim();
}
