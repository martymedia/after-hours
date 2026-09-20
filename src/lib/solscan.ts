// Links into the block explorer. Every number on this site is derived from
// something onchain, so every token we name has to be checkable against the
// chain rather than against our word for it.

const BASE = "https://solscan.io";

export const solscanToken = (mint: string) => `${BASE}/token/${mint}`;
export const solscanAccount = (address: string) => `${BASE}/account/${address}`;
export const solscanTx = (signature: string) => `${BASE}/tx/${signature}`;

/** An address short enough to sit in a line of text and still be recognised. */
export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
