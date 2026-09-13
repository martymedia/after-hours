"use client";

// A wallet followed by address in this browser. iPhones trade inside the
// wallet app's browser, but push notifications only work from the Home
// Screen icon (Safari), where no wallet can connect. Following by address
// bridges the two: the icon shows the same wallet page and can subscribe
// to its fills and price alerts.

const KEY = "followed-wallet";
export const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function followedWallet(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && BASE58.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function followWallet(address: string): void {
  try {
    localStorage.setItem(KEY, address);
  } catch {}
}

export function unfollowWallet(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
