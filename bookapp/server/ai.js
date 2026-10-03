// ai.js — ajuda de IA pra escrever a carta: manda um áudio (ou texto solto) pro Gemini e
// pede pra ele organizar isso num texto de carta carinhosa, no formato "Querida [nome]...".
// Usa a API nativa do Gemini ("Interactions"), via fetch puro — sem precisar instalar
// nenhum pacote. (O endpoint compatível com OpenAI só aceita áudio em wav/mp3 — o que o
// navegador grava é webm/mp4, e só a API nativa aceita esses formatos direto.)
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const aiEnabled = Boolean(process.env.GEMINI_API_KEY);

// mapeia o formato que o navegador grava pro mime type que a API do Gemini espera.
const MIME_BY_FORMAT = {
  webm: 'audio/webm',
  mp4: 'audio/m4a',
  m4a: 'audio/m4a',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mp3',
};

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

// Acha o texto gerado dentro da resposta da API de Interactions — ele vem dentro de uma
// lista de "steps" (pode ter mais de um, ex: se o modelo "pensar" em etapas), então
// procuramos o step de saída e o pedaço de conteúdo do tipo texto.
function extractOutputText(interaction) {
  const steps = interaction?.steps || [];
  for (const step of steps) {
    if (step.type !== 'model_output') continue;
    const textPart = (step.content || []).find((c) => c.type === 'text');
    if (textPart?.text) return textPart.text;
  }
  return null;
}

// context: { bookTitle, bookAuthor, recipientName, authorName }
// input: { text } OU { audioBase64, format } (format: 'webm' | 'mp3' | 'wav' | 'm4a' | 'ogg' etc.)
export async function draftLetterWithAI(context, input) {
  if (!aiEnabled) throw new Error('IA não configurada — defina GEMINI_API_KEY nas variáveis de ambiente.');

  const promptInput = [{ type: 'text', text: buildPrompt(context) }];
  if (input.audioBase64) {
    const mimeType = MIME_BY_FORMAT[input.format] || 'audio/webm';
    promptInput.push({ type: 'audio', data: input.audioBase64, mime_type: mimeType });
  } else if (input.text) {
    promptInput.push({ type: 'text', text: `Pensamentos soltos:\n${input.text}` });
  } else {
    throw new Error('informe audioBase64 ou text');
  }

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({ model: GEMINI_MODEL, input: promptInput }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini respondeu com erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const interaction = await res.json();
  if (interaction.status && interaction.status !== 'completed') {
    throw new Error(`A IA não terminou de responder (status: ${interaction.status}) — tenta de novo.`);
  }
  const text = extractOutputText(interaction);
  if (!text) throw new Error('a IA não devolveu nenhum texto — tenta de novo.');
  return text.trim();
}
