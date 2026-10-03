// ai.js — grava a voz de quem está escrevendo a carta e pede pra IA (Gemini) organizar
// isso num texto de carta carinhosa, que entra no campo de texto pra ela revisar antes
// de salvar. Nada é enviado sem a pessoa apertar o botão de gravar/gerar.
import { api } from './api.js';

export function isRecordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

// Pega o primeiro formato de áudio que o navegador sabe gravar (varia entre
// Chrome/Firefox — geralmente webm — e Safari/iOS, que geralmente só aceita mp4).
function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg',
  ];
  return candidates.find((c) => window.MediaRecorder.isTypeSupported?.(c)) || '';
}

function mimeToFormat(mimeType) {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

// Cria um gravador controlável. Uso:
//   const rec = await startRecording();
//   ... (depois) ...
//   const { blob, format } = await rec.stop();
export async function startRecording() {
  if (!isRecordingSupported()) throw new Error('Seu navegador não suporta gravar áudio.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const stopPromise = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      resolve({ blob, format: mimeToFormat(recorder.mimeType || mimeType || 'audio/webm') });
    };
  });
  recorder.start();
  return {
    stop: () => { recorder.stop(); return stopPromise; },
    cancel: () => { recorder.onstop = () => stream.getTracks().forEach((t) => t.stop()); recorder.stop(); },
  };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não consegui processar o áudio gravado.'));
    reader.onload = () => {
      // reader.result é algo como "data:audio/webm;base64,AAAA..." — só queremos a parte depois da vírgula.
      const base64 = String(reader.result).split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function checkAiStatus() {
  try {
    const { enabled } = await api.get('/ai/status');
    return enabled;
  } catch (e) {
    return false;
  }
}

export async function draftLetterFromAudio(blob, format, bookId) {
  const audio_base64 = await blobToBase64(blob);
  const { text } = await api.post('/ai/draft-letter', { audio_base64, format, book_id: bookId });
  return text;
}

export async function draftLetterFromText(text, bookId) {
  const { text: draft } = await api.post('/ai/draft-letter', { text, book_id: bookId });
  return draft;
}
