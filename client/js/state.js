// state.js — estado global simples em memória (sem framework).
import { api } from './api.js';

export const state = {
  currentUser: null,
  allUsers: [],
};

export function setSession(token, user) {
  localStorage.setItem('bbb_token', token);
  state.currentUser = user;
}

export function clearSession() {
  localStorage.removeItem('bbb_token');
  state.currentUser = null;
}

export async function bootstrapSession() {
  const token = api.getToken();
  if (!token) return null;
  try {
    const { user } = await api.get('/auth/me');
    state.currentUser = user;
    return user;
  } catch (e) {
    clearSession();
    return null;
  }
}

export async function loadAllUsers() {
  const { users } = await api.get('/users');
  state.allUsers = users;
  return users;
}

export function friendOf(currentUsername) {
  return state.allUsers.find((u) => u.username !== currentUsername) || null;
}

export const EMOJIS = ['❤️', '😭', '😂', '😱', '👀', '🥹', '😤', '🤯', '⭐', '🥰'];

export const STATUS_META = {
  quero_ler: { label: 'Quero ler', emoji: '📚', color: 'lavender' },
  lendo: { label: 'Lendo', emoji: '📖', color: 'plum' },
  lido: { label: 'Lido', emoji: '✅', color: 'sage' },
  pausado: { label: 'Pausado', emoji: '⏸️', color: 'gold' },
  abandonei: { label: 'Abandonei', emoji: '❌', color: 'blush' },
};
