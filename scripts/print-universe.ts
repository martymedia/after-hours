// Prints the tracked universe grouped by stock. Handy sanity check.
import { buildUniverse } from "../src/lib/universe.ts";

const tokens = await buildUniverse();
const byUnderlying = new Map<string, typeof tokens>();
for (const t of tokens) {
  const arr = byUnderlying.get(t.underlying) ?? [];
  arr.push(t);
  byUnderlying.set(t.underlying, arr);
}
for (const [u, list] of [...byUnderlying.entries()].sort()) {
  console.log(
    u.padEnd(10),
    list.map((t) => `${t.symbol}[${t.issuer}] $${Math.round(t.liquidity / 1000)}k`).join("  "),
  );
}
console.log(`${tokens.length} tokens, ${byUnderlying.size} stocks`);
