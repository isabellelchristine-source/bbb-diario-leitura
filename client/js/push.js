// push.js — ativa notificações push de verdade (chegam mesmo com o app fechado ou o
// celular bloqueado), usando o Web Push padrão do navegador.
import { api } from './api.js';
import { toast } from './components.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// 'unsupported' | 'denied' | 'subscribed' | 'not-subscribed'
export async function getPushStatus() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'not-subscribed';
  } catch (e) {
    return 'not-subscribed';
  }
}

export async function enablePush() {
  if (!isPushSupported()) {
    toast('Seu navegador não suporta notificações push.');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast('Você não autorizou as notificações — dá pra ativar depois nas configurações do navegador.');
      return false;
    }
    const { publicKey, enabled } = await api.get('/push/vapid-public-key');
    if (!enabled) {
      toast('Notificações push ainda não estão configuradas no servidor.');
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    await api.post('/push/subscribe', { subscription: sub.toJSON() });
    toast('Notificações ativadas! 🔔');
    return true;
  } catch (e) {
    toast('Não consegui ativar as notificações agora: ' + e.message);
    return false;
  }
}

export async function disablePush() {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    toast('Notificações desativadas.');
  } catch (e) { toast(e.message); }
}
