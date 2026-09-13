// Sends Web Push messages to every device a wallet has registered. Dead
// subscriptions (404, 410) are dropped on the way.

import webpush from "web-push";
import { deleteSubscription, subscriptionsFor } from "./notify-db.ts";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@after-hour.net", pub, priv);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return configure();
}

/** Delivers to all devices of the owner; returns how many accepted it. */
export async function sendPush(owner: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  let delivered = 0;
  for (const s of subscriptionsFor(owner)) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      delivered++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) deleteSubscription(s.endpoint);
    }
  }
  return delivered;
}
