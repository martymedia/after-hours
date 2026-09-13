// Browser side of Web Push: register the service worker, ask permission,
// subscribe with the server's VAPID key, and tell the server which wallet
// the device belongs to.

export type PushState = "unsupported" | "needs-install" | "in-wallet-browser" | "denied" | "off" | "on";

function base64ToBytes(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** iPhones only deliver push to sites installed on the home screen. */
export function needsInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

/** Inside a wallet app's browser (Phantom, Solflare, Backpack) on iOS: no push there. */
export function inWalletBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const w = window as Window & { phantom?: unknown; solflare?: unknown; backpack?: unknown };
  return ios && Boolean(w.phantom || w.solflare || w.backpack);
}

function unavailableState(): PushState {
  if (inWalletBrowser()) return "in-wallet-browser";
  return needsInstall() ? "needs-install" : "unsupported";
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function currentState(owner: string): Promise<PushState> {
  if (!pushSupported()) return unavailableState();
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return "off";
    const res = await fetch(`/api/push?owner=${owner}&endpoint=${encodeURIComponent(sub.endpoint)}`);
    const body = (await res.json()) as { subscribed?: boolean };
    return body.subscribed ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(owner: string): Promise<PushState> {
  if (!pushSupported()) return unavailableState();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const keyRes = await fetch("/api/push");
  const { publicKey } = (await keyRes.json()) as { publicKey: string | null };
  if (!publicKey) throw new Error("Push is not configured on the server.");
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) as BufferSource }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "subscribe", owner, subscription: json }) });
  if (!res.ok) throw new Error("Could not register this device.");
  return "on";
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}

export async function sendTestPush(owner: string): Promise<number> {
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test", owner }) });
  const body = (await res.json()) as { delivered?: number };
  return body.delivered ?? 0;
}
