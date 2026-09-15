"use client";

// Curve builder: pick a stock, say where the launch should start and
// graduate in dollars, and get a Meteora DBC configuration anchored to the
// stock's real price. Preview runs the SDK's validation on the server; the
// optional "Create on mainnet" signs one transaction in the user's wallet.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
} from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { Check, Copy } from "lucide-react";
import type { RadarRow } from "@/lib/radar-types";
import type { CurvePreview, CurveInput } from "@/lib/curve-builder";
import { solanaClient } from "@/lib/solana-client";
import { useWalletReady } from "@/lib/wallet-ready";
import { formatUsd } from "@/lib/format";
import { explainError, waitForConfirmation } from "./buy-button";
import { Seg, SuccessCheck, SwapText } from "./motion";
import { TickerBadge } from "./ticker-badge";

const ConnectButton = dynamic(
  () => import("./wallet-connect").then((m) => m.ConnectButton),
  {
    ssr: false,
    loading: () => (
      <span className="btn w-full opacity-50">Checking wallets…</span>
    ),
  },
);

const DEFAULTS: Omit<CurveInput, "stockMint"> = {
  supply: 1_000_000_000,
  initialMcapUsd: 5_000,
  migrationMcapUsd: 50_000,
  startFeeBps: 500,
  endFeeBps: 100,
  feeMinutes: 60,
  creatorFeePct: 50,
};
const START_CAPS = [1_000, 5_000, 25_000, 100_000];
const GRAD_CAPS = [25_000, 50_000, 250_000, 1_000_000];
type FeeId = "gentle" | "standard" | "antisnipe";
const FEE_PRESETS: {
  id: FeeId;
  label: string;
  start: number;
  end: number;
  minutes: number;
}[] = [
  { id: "gentle", label: "Gentle 1% flat", start: 100, end: 100, minutes: 1 },
  {
    id: "standard",
    label: "5% to 1% over an hour",
    start: 500,
    end: 100,
    minutes: 60,
  },
  {
    id: "antisnipe",
    label: "Anti-snipe 30% to 1%",
    start: 3000,
    end: 100,
    minutes: 30,
  },
];

type Step = "idle" | "building" | "signing" | "confirming" | "done" | "error";

function tiny(v: number): string {
  if (v >= 1) return formatUsd(v);
  return `$${v.toPrecision(3)}`;
}

export function CurveBuilder() {
  const [stocks, setStocks] = useState<RadarRow[]>([]);
  const [stockMint, setStockMint] = useState("");
  const [form, setForm] = useState(DEFAULTS);
  const [feeId, setFeeId] = useState<FeeId>("standard");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [preview, setPreview] = useState<CurvePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(
    null,
  );
  const [created, setCreated] = useState<{
    signature: string;
    pool: string;
    baseMint: string;
    symbol: string;
  } | null>(null);
  const ready = useWalletReady();
  const connected = useConnectedWallet(solanaClient);

  useEffect(() => {
    fetch("/api/radar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { rows: RadarRow[] }) => {
        const rows = [...d.rows]
          .filter((r) => r.tradability !== "none")
          .sort((a, b) => a.name.localeCompare(b.name));
        setStocks(rows);
        setStockMint(
          (m) =>
            m ||
            rows.find((r) => r.symbol === "SPYx")?.mint ||
            rows[0]?.mint ||
            "",
        );
      })
      .catch(() => {});
  }, []);

  // Preview follows the form with a short debounce; the server runs the SDK validation.
  useEffect(() => {
    if (!stockMint) return;
    const id = setTimeout(() => {
      fetch("/api/curves/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stockMint, ...form }),
      })
        .then(async (r) => {
          const body = (await r.json()) as CurvePreview & { error?: string };
          if (!r.ok) throw new Error(body.error ?? "could not build the curve");
          setPreview(body);
          setPreviewError(null);
        })
        .catch((err) => setPreviewError((err as Error).message));
    }, 350);
    return () => clearTimeout(id);
  }, [stockMint, form]);

  const stock = stocks.find((s) => s.mint === stockMint) ?? null;
  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));
  const pickFee = (id: FeeId) => {
    const p = FEE_PRESETS.find((f) => f.id === id)!;
    setFeeId(id);
    set({ startFeeBps: p.start, endFeeBps: p.end, feeMinutes: p.minutes });
  };
  const busy =
    step === "building" || step === "signing" || step === "confirming";
  const canCreate = Boolean(
    preview &&
    preview.warnings.every((w) => !w.includes("badge")) &&
    name.trim().length >= 2 &&
    symbol.trim().length >= 2 &&
    connected?.signer,
  );

  async function create() {
    if (!connected?.signer || !preview) return;
    try {
      setStep("building");
      setError(null);
      const res = await fetch("/api/curves/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stockMint,
          ...form,
          create: true,
          name,
          symbol,
          payer: connected.account.address,
        }),
      });
      const body = (await res.json()) as {
        transaction?: string;
        pool?: string;
        baseMint?: string;
        symbol?: string;
        error?: string;
      };
      if (!res.ok || !body.transaction)
        throw new Error(body.error ?? "could not build the transaction");
      setStep("signing");
      const tx = getTransactionDecoder().decode(
        getBase64Encoder().encode(body.transaction),
      );
      const signer = connected.signer;
      if (!("signAndSendTransactions" in signer))
        throw new Error("Wallet has no signing feature");
      const [raw] = await signer.signAndSendTransactions([tx]);
      const sig = getBase58Decoder().decode(raw);
      setStep("confirming");
      const ok = await waitForConfirmation(sig, 120_000);
      if (!ok)
        throw new Error(
          "unconfirmed: the network has not confirmed this yet. Check Solscan before trying again.",
        );
      setCreated({
        signature: sig,
        pool: body.pool!,
        baseMint: body.baseMint!,
        symbol: body.symbol ?? symbol,
      });
      setStep("done");
    } catch (err) {
      const [title, hint] = explainError((err as Error).message ?? String(err));
      setStep("error");
      setError({ title, hint });
    }
  }

  const copyJson = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(preview.params, null, 2),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (step === "done" && created) {
    return (
      <div className="rise card-dark p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue">
            <SuccessCheck size={22} />
          </span>
          <div>
            <p className="text-lg leading-tight font-semibold">
              Curve is live on mainnet.
            </p>
            <p className="text-on-dark-muted text-sm">
              {created.symbol} now trades on a bonding curve priced in{" "}
              {stock?.symbol}. It shows up under Curves after the next refresh.
            </p>
          </div>
        </div>
        <dl className="num mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <dt className="text-on-dark-muted">Pool</dt>
            <dd className="mt-0.5 break-all">{created.pool}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <dt className="text-on-dark-muted">Token mint</dt>
            <dd className="mt-0.5 break-all">{created.baseMint}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://solscan.io/tx/${created.signature}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-white btn-sm"
          >
            View on Solscan
          </a>
          <Link
            href="/curves"
            className="btn btn-sm border border-white/20 bg-transparent hover:bg-white/10"
          >
            Back to Curves
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Inputs */}
      <section className="card p-5 lg:col-span-6">
        <h3 className="font-semibold">Anchor</h3>
        <p className="text-muted mt-1 text-sm">
          The curve is priced in this stock. Every dollar figure below is
          converted through its onchain price right now.
        </p>
        <label className="mt-4 block">
          <span className="text-muted text-xs font-medium">Quote stock</span>
          <div className="mt-1.5 flex items-center gap-3">
            {stock && (
              <TickerBadge symbol={stock.symbol} logo={stock.logo} size={36} />
            )}
            <select
              value={stockMint}
              onChange={(e) => setStockMint(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-full bg-soft px-3 text-sm font-medium outline-none"
              aria-label="Quote stock"
            >
              {stocks.map((s) => (
                <option key={s.mint} value={s.mint}>
                  {s.name} ({s.symbol}) ·{" "}
                  {s.price != null ? formatUsd(s.price) : "–"}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-muted text-xs font-medium">
              Starting market cap
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-soft px-4 py-2.5">
              <span className="text-muted">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.initialMcapUsd}
                onChange={(e) =>
                  set({
                    initialMcapUsd:
                      Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                  })
                }
                className="num w-full bg-transparent text-lg font-semibold outline-none"
                aria-label="Starting market cap in USD"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {START_CAPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set({ initialMcapUsd: v })}
                  className={`pill ${form.initialMcapUsd === v ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}
                >
                  {formatUsd(v, 0)}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-muted text-xs font-medium">
              Graduates to a DAMM v2 pool at
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-soft px-4 py-2.5">
              <span className="text-muted">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.migrationMcapUsd}
                onChange={(e) =>
                  set({
                    migrationMcapUsd:
                      Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                  })
                }
                className="num w-full bg-transparent text-lg font-semibold outline-none"
                aria-label="Graduation market cap in USD"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GRAD_CAPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set({ migrationMcapUsd: v })}
                  className={`pill ${form.migrationMcapUsd === v ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}
                >
                  {formatUsd(v, 0)}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className="mt-5">
          <span className="text-muted text-xs font-medium">
            Trading fee on the curve
          </span>
          <div className="mt-1.5">
            <Seg
              ariaLabel="Fee schedule"
              value={feeId}
              onChange={pickFee}
              options={FEE_PRESETS.map((f) => ({ id: f.id, label: f.label }))}
              className="w-full justify-between"
            />
          </div>
          <p className="text-muted mt-1.5 text-xs">
            Starts at {form.startFeeBps / 100}%, decays to{" "}
            {form.endFeeBps / 100}% over {form.feeMinutes} min, then the DAMM
            pool charges 1%. Half of the trading fee goes to the creator, half
            to the fee claimer.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="text-muted text-xs font-medium">Total supply</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.supply}
              onChange={(e) =>
                set({
                  supply: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                })
              }
              className="num mt-1.5 h-10 w-full rounded-full bg-soft px-4 text-sm font-medium outline-none"
              aria-label="Total supply"
            />
          </label>
          <label className="block">
            <span className="text-muted text-xs font-medium">Token name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Night Owl"
              maxLength={32}
              className="mt-1.5 h-10 w-full rounded-full bg-soft px-4 text-sm font-medium outline-none"
              aria-label="Token name"
            />
          </label>
          <label className="block">
            <span className="text-muted text-xs font-medium">Symbol</span>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="OWL"
              maxLength={10}
              className="mt-1.5 h-10 w-full rounded-full bg-soft px-4 text-sm font-medium uppercase outline-none"
              aria-label="Token symbol"
            />
          </label>
        </div>
      </section>

      {/* Preview and create */}
      <section className="card p-5 lg:col-span-6">
        <h3 className="font-semibold">What the curve does</h3>
        {previewError ? (
          <p className="text-warn mt-3 text-sm">{previewError}</p>
        ) : !preview ? (
          <div className="mt-3 h-40 animate-pulse rounded-2xl bg-soft" />
        ) : (
          <>
            <dl className="num mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-soft p-3">
                <dt className="text-muted text-xs">Starts at</dt>
                <dd className="mt-0.5 font-semibold">
                  {tiny(preview.startPriceUsd)}
                </dd>
                <dd className="text-muted text-xs">per token</dd>
              </div>
              <div className="rounded-2xl bg-soft p-3">
                <dt className="text-muted text-xs">Graduates at</dt>
                <dd className="mt-0.5 font-semibold">
                  {tiny(preview.migrationPriceUsd)}
                </dd>
                <dd className="text-muted text-xs">per token</dd>
              </div>
              <div className="rounded-2xl bg-ink p-3 text-white">
                <dt className="text-on-dark-muted text-xs">Needs to raise</dt>
                <dd className="mt-0.5 font-semibold">
                  {preview.thresholdQuote.toFixed(
                    preview.thresholdQuote >= 100 ? 1 : 3,
                  )}{" "}
                  {preview.stock.symbol}
                </dd>
                <dd className="text-on-dark-muted text-xs">
                  ≈ {formatUsd(preview.thresholdUsd, 0)} at{" "}
                  {formatUsd(preview.stock.price)} per {preview.stock.symbol}
                </dd>
              </div>
              <div className="rounded-2xl bg-soft p-3">
                <dt className="text-muted text-xs">Fee path</dt>
                <dd className="mt-0.5 font-semibold">
                  {preview.fee.startBps / 100}% → {preview.fee.endBps / 100}%
                </dd>
                <dd className="text-muted text-xs">
                  over {preview.fee.minutes} min, dynamic fee on
                </dd>
              </div>
            </dl>
            {preview.warnings.map((w) => (
              <p key={w} className="text-warn mt-3 text-xs">
                {w}
              </p>
            ))}
            <p className="text-muted mt-3 text-xs">
              Anchored to {preview.stock.symbol} at{" "}
              {formatUsd(preview.stock.price)} onchain. If the stock moves, the
              dollar values move with it; the curve itself is fixed in{" "}
              {preview.stock.symbol}. Liquidity on graduation is locked forever,
              half to the creator, half to the fee claimer (both your wallet).
            </p>
            <details className="mt-3">
              <summary className="text-muted cursor-pointer text-xs hover:text-ink">
                SDK config parameters (validated)
              </summary>
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={copyJson}
                  className="pill absolute top-2 right-2 bg-card text-ink hover:bg-soft"
                  aria-label="Copy JSON"
                >
                  {copied ? (
                    <Check size={12} strokeWidth={2.5} />
                  ) : (
                    <Copy size={12} strokeWidth={2} />
                  )}
                  <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
                </button>
                <pre className="num max-h-64 overflow-auto rounded-2xl bg-soft p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(preview.params, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <h4 className="text-sm font-semibold">Create it on mainnet</h4>
          <p className="text-muted mt-1 text-xs">
            One transaction creates the config and the pool. It costs about 0.05
            SOL in account rent, no pool creation fee. This launches a real
            token: name it accordingly.
          </p>
          <div className="mt-3">
            {!ready ? (
              <span className="btn w-full opacity-50">Checking wallets…</span>
            ) : !connected ? (
              <ConnectButton label="Connect wallet to create" />
            ) : (
              <button
                type="button"
                className="btn w-full"
                disabled={busy || !canCreate}
                onClick={create}
              >
                <SwapText
                  className={busy ? "t-shimmer" : ""}
                  text={
                    step === "building"
                      ? "Preparing the transaction…"
                      : step === "signing"
                        ? "Confirm in your wallet…"
                        : step === "confirming"
                          ? "Creating onchain…"
                          : `Create ${symbol || "the curve"} priced in ${stock?.symbol ?? "the stock"}`
                  }
                />
              </button>
            )}
          </div>
          {connected && !canCreate && step === "idle" && (
            <p className="text-muted mt-2 text-xs">
              Give the token a name and a symbol, and pick a badged stock.
            </p>
          )}
          {step === "error" && error && (
            <div
              key={error.title}
              className="rise t-shake mt-3 rounded-2xl border border-line bg-soft p-4"
            >
              <p className="text-sm font-semibold">{error.title}</p>
              <p className="text-muted mt-0.5 text-sm leading-relaxed">
                {error.hint}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
