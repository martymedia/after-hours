// Price alerts per wallet: "tell me when SYMBOL is X% cheaper (or pricier)
// than the reference". One-shot; fired alerts stay listed until deleted.

import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createAlert, deleteAlert, listAlerts } from "@/lib/notify-db";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  if (!BASE58.test(owner)) return Response.json({ error: "bad owner" }, { status: 400 });
  const tokens = new Map((getDb().prepare("SELECT mint, symbol, name, underlying FROM tokens").all() as { mint: string; symbol: string; name: string; underlying: string }[]).map((t) => [t.mint, t]));
  const alerts = listAlerts(owner).map((a) => ({ ...a, symbol: tokens.get(a.mint)?.symbol ?? "?", name: tokens.get(a.mint)?.name ?? a.mint, underlying: tokens.get(a.mint)?.underlying ?? "" }));
  return Response.json({ alerts }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body: { owner?: string; mint?: string; kind?: "cheaper" | "pricier"; threshold?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const threshold = Number(body.threshold);
  if (!BASE58.test(body.owner ?? "") || !BASE58.test(body.mint ?? "") || !["cheaper", "pricier"].includes(body.kind ?? "") || !(threshold >= 0.5 && threshold <= 50)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const exists = getDb().prepare("SELECT 1 FROM tokens WHERE mint = ? AND active = 1").get(body.mint!);
  if (!exists) return Response.json({ error: "unknown token" }, { status: 404 });
  if (listAlerts(body.owner!).length >= 20) return Response.json({ error: "too many alerts" }, { status: 429 });
  return Response.json({ alert: createAlert(body.owner!, body.mint!, body.kind!, threshold) });
}

export async function DELETE(req: NextRequest) {
  let body: { owner?: string; id?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!BASE58.test(body.owner ?? "") || !Number.isInteger(body.id)) return Response.json({ error: "bad request" }, { status: 400 });
  deleteAlert(body.id!, body.owner!);
  return Response.json({ ok: true });
}
