// Web Push registration. GET returns the public VAPID key and, given an
// owner and endpoint, whether that device is registered; POST stores a
// subscription for a wallet; DELETE removes it. POST with action "test"
// sends a test message to that wallet's devices.

import type { NextRequest } from "next/server";
import { deleteSubscription, hasSubscription, upsertSubscription } from "@/lib/notify-db";
import { pushEnabled, sendPush } from "@/lib/push";
import { SITE_URL } from "@/lib/brand";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  return Response.json({
    enabled: pushEnabled(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    subscribed: BASE58.test(owner) && endpoint ? hasSubscription(owner, endpoint) : false,
  });
}

type Body = { action?: "subscribe" | "test"; owner?: string; subscription?: { endpoint: string; keys: { p256dh: string; auth: string } } };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const owner = body.owner ?? "";
  if (!BASE58.test(owner)) return Response.json({ error: "bad owner" }, { status: 400 });
  if (!pushEnabled()) return Response.json({ error: "push not configured" }, { status: 503 });

  if (body.action === "test") {
    const n = await sendPush(owner, {
      title: "After Hours is set up",
      body: "This is how order fills and price alerts will arrive.",
      url: `${SITE_URL}/wallet`,
      tag: "test",
    });
    return Response.json({ delivered: n });
  }

  const s = body.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth || !/^https:\/\//.test(s.endpoint)) {
    return Response.json({ error: "bad subscription" }, { status: 400 });
  }
  upsertSubscription(owner, s);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.endpoint) return Response.json({ error: "bad request" }, { status: 400 });
  deleteSubscription(body.endpoint);
  return Response.json({ ok: true });
}
