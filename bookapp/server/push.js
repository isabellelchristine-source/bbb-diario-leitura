// push.js — notificações push de verdade (chegam no celular mesmo com o app fechado),
// usando o protocolo Web Push padrão do navegador (sem depender de nenhum app/serviço
// de terceiro tipo Firebase — funciona com a chave VAPID que a gente mesma gera).
import webpush from 'web-push';
import db from './db.js';
import { newId, nowIso } from './util.js';

// Chaves VAPID: identificam o "remetente" pro navegador/serviço de push confiar que as
// notificações vêm da gente. Em produção, defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY nas
// variáveis de ambiente do Render — sem isso, o envio de push fica desligado (o resto do
// app continua funcionando normal, só sem notificação de celular).
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BMbZNFm-xRcFAGjSgzWV7P0eND5ma45qzgzrBc3mZ395-gGFXRgT5F0t27ogsz9q82euL-QwUbyK0VLfIh1NbR8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'qTCV1xePv8V_q5L4xbalGk2ZQbhTZMn_r3ThfoXidUg';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:bbb-diario@example.com';

export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('inscrição inválida');
  const existing = await db.get('SELECT * FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  if (existing) {
    await db.run('UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE id = ?', [userId, keys.p256dh, keys.auth, existing.id]);
    return existing.id;
  }
  const id = newId('push');
  await db.run(
    'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, endpoint, keys.p256dh, keys.auth, nowIso()],
  );
  return id;
}

export async function removeSubscription(endpoint) {
  await db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

// Manda uma notificação push pra todos os aparelhos em que `userId` autorizou.
// title/body aparecem na notificação; url é pra onde o toque nela deve levar (reaproveita
// o mesmo esquema de deep-link "/book/:id?focus=..." usado na central de notificações).
export async function sendPushToUser(userId, { title, body, url }) {
  if (!pushEnabled) return;
  const subs = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
  if (!subs.length) return;
  const payload = JSON.stringify({ title, body, url: url || '/' });
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
    } catch (e) {
      // 404/410 = a inscrição não existe mais (usuária desinstalou, trocou de navegador, etc.)
      // — limpamos pra não ficar tentando de novo pra sempre.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await removeSubscription(sub.endpoint).catch(() => {});
      } else {
        console.error('erro ao enviar push:', e.message || e);
      }
    }
  }));
}
