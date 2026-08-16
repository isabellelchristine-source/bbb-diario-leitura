// modal.js — modal genérico usado em todo o app.
import { h } from './components.js';

let backdropEl = null;

export function closeModal() {
  if (backdropEl) {
    backdropEl.remove();
    backdropEl = null;
  }
}

function hasUnsavedText(modalEl) {
  // se tem algum campo de texto com conteúdo digitado, clicar fora não deve descartar sem avisar.
  const fields = modalEl.querySelectorAll('textarea, input[type="text"], input:not([type])');
  return Array.from(fields).some((f) => f.value && f.value.trim().length > 0);
}

export function openModal(innerHtml, { onMount } = {}) {
  closeModal();
  backdropEl = h(`<div class="modal-backdrop"><div class="modal">${innerHtml}</div></div>`);
  backdropEl.addEventListener('click', (e) => {
    if (e.target !== backdropEl) return;
    const modalEl = backdropEl.querySelector('.modal');
    if (hasUnsavedText(modalEl) && !confirm('Você digitou algo aqui. Fechar sem salvar?')) return;
    closeModal();
  });
  document.body.appendChild(backdropEl);
  const modalEl = backdropEl.querySelector('.modal');
  if (onMount) onMount(modalEl);
  return modalEl;
}
