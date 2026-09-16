"use client";

// Take part in a stock-quoted bonding curve: buy the launch token with the
// stock token, or sell it back to the curve. The creator of a curve also
// sees the fees waiting for them and can claim them. All transactions are
// built server-side and signed in the user's wallet.

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
} from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import type { CurveQuote } from "@/lib/curve-trade";
import { solanaClient } from "@/lib/solana-client";
import { useWalletReady } from "@/lib/wallet-ready";
import { formatUsd } from "@/lib/format";
import { explainError, waitForConfirmation } from "./buy-button";
import type { RadarData } from "@/lib/radar-types";
import { Modal, ModalClose } from "./modal";
import { Seg, SuccessCheck, SwapText } from "./motion";
import { PoolAvatar } from "./pool-avatar";

const BuyPanel = dynamic(() => import("./buy-panel").then((m) => m.BuyPanel), {
  ssr: false,
  loading: () => (
    <div className="t-shimmer h-40 rounded-2xl bg-soft" aria-hidden="true" />
  ),
});

const ConnectButton = dynamic(
  () => import("./wallet-connect").then((m) => m.ConnectButton),
  {
    ssr: false,
    loading: () => (
      <span className="btn w-full opacity-50">Checking wallets…</span>
    ),
  },
);

export type PoolActionProps = {
  pool: string;
  creator: string;
  baseMint: string;
  baseName: string;
  baseSymbol: string | null;
  image: string | null;
  progress: number;
  raisedQuote: number;
  quoteMint: string;
  quoteSymbol: string;
  underlying: string;
  stockPrice: number | null;
  migrated: boolean;
};

const USD_PRESETS = [5, 25, 100];
const PARTS = [0.25, 0.5, 1];
type Side = "buy" | "sell";
type Step = "idle" | "building" | "signing" | "confirming" | "done" | "error";
type Signer = NonNullable<
  NonNullable<ReturnType<typeof useConnectedWallet>>["signer"]
>;

function fmtQuote(n: number): string {
  if (n === 0) return "0";
  return n >= 1 ? n.toFixed(4) : Number(n.toPrecision(4)).toString();
}
function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n >= 1 ? n.toFixed(2) : n.toPrecision(3);
}
function spendFor(usd: number, stockPrice: number | null): string {
  return stockPrice ? String(Number((usd / stockPrice).toFixed(4))) : "0.01";
}
/** A share of a balance, rounded down so "All" never asks for more than there is. */
function partOf(balance: number, share: number): string {
  const n = Math.floor(balance * share * 1e6) / 1e6;
  return String(n);
}

/** Signs and sends a server-built transaction, resolving to its signature. */
async function signTx(signer: Signer, base64: string): Promise<string> {
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(base64));
  if (!("signAndSendTransactions" in signer))
    throw new Error("Wallet has no signing feature");
  const [raw] = await signer.signAndSendTransactions([tx]);
  return getBase58Decoder().decode(raw);
}

async function confirmOrThrow(sig: string): Promise<void> {
  const ok = await waitForConfirmation(sig, 120_000);
  if (!ok)
    throw new Error(
      "unconfirmed: the network has not confirmed this yet. Check Solscan before trying again.",
    );
}

export function CurvePoolActions(props: PoolActionProps) {
  const [open, setOpen] = useState(false);
  if (props.migrated) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-sm"
      >
        Trade
      </button>
      {open && <TradeModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function TradeModal(props: PoolActionProps & { onClose: () => void }) {
  const {
    pool,
    baseMint,
    baseName,
    baseSymbol,
    image,
    progress,
    raisedQuote,
    quoteMint,
    quoteSymbol,
    underlying,
    stockPrice,
    onClose,
  } = props;
  const [side, setSide] = useState<Side>("buy");
  const [typed, setTyped] = useState<string | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [quoteHeld, setQuoteHeld] = useState<number | null>(null);
  // Buying the stock token to pay with, without leaving this window.
  const [buying, setBuying] = useState(false);
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [fetched, setFetched] = useState<CurveQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(
    null,
  );
  const [done, setDone] = useState<{ signature: string; out: number } | null>(
    null,
  );
  const ready = useWalletReady();
  const connected = useConnectedWallet(solanaClient);
  const owner = connected?.account.address ?? null;
  // The amount starts from what the wallet can actually afford, and stays
  // whatever was typed once someone types.
  const balance = side === "buy" ? quoteHeld : held;
  const suggested = balance
    ? partOf(balance, side === "buy" ? 0.25 : 1)
    : side === "buy"
      ? spendFor(25, stockPrice)
      : "0";
  const text = typed ?? suggested;
  const amount = Number(text.replace(",", "."));
  const valid = Number.isFinite(amount) && amount > 0;
  const tokenLabel =
    baseSymbol ?? (baseName === "(name pending)" ? "tokens" : baseName);
  const pct = Math.round(progress * 100);

  // What the wallet holds of both sides: the launch token to sell, and the
  // stock token to pay with. One call covers both.
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    fetch(`/api/balances?owner=${owner}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { amounts?: Record<string, number> } | null) => {
        if (cancelled || !b?.amounts) return;
        setHeld(b.amounts[baseMint] ?? 0);
        setQuoteHeld(b.amounts[quoteMint] ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner, baseMint, quoteMint, step, refresh]);

  useEffect(() => {
    if (!buying || radar) return;
    let cancelled = false;
    fetch("/api/radar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: RadarData | null) => {
        if (!cancelled && b) setRadar(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [buying, radar]);

  // A quote is only shown while it matches the current input.
  const quote =
    fetched && fetched.side === side && fetched.amountIn === amount && valid
      ? fetched
      : null;

  useEffect(() => {
    if (!valid) return;
    const id = setTimeout(() => {
      fetch("/api/curves/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pool, side, amount }),
      })
        .then(async (r) => {
          const b = (await r.json()) as CurveQuote & { error?: string };
          if (!r.ok) throw new Error(b.error ?? "no quote");
          setFetched(b);
          setQuoteError(null);
        })
        .catch((e) => {
          setFetched(null);
          setQuoteError((e as Error).message);
        });
    }, 300);
    return () => clearTimeout(id);
  }, [pool, side, amount, valid]);

  const switchSide = (s: Side) => {
    setSide(s);
    setFetched(null);
    setTyped(null);
  };
  const busy =
    step === "building" || step === "signing" || step === "confirming";
  // A buy the wallet cannot pay for: say so before the wallet does.
  const short =
    side === "buy" && valid && quoteHeld != null && amount > quoteHeld;

  async function trade() {
    if (!connected?.signer || !valid) return;
    try {
      setStep("building");
      setError(null);
      const res = await fetch("/api/curves/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pool,
          side,
          amount,
          owner: connected.account.address,
          execute: true,
        }),
      });
      const b = (await res.json()) as {
        transaction?: string;
        quote?: CurveQuote;
        error?: string;
      };
      if (!res.ok || !b.transaction)
        throw new Error(b.error ?? "could not build the swap");
      setStep("signing");
      const sig = await signTx(connected.signer, b.transaction);
      setStep("confirming");
      await confirmOrThrow(sig);
      setDone({
        signature: sig,
        out: b.quote?.amountOut ?? quote?.amountOut ?? 0,
      });
      setStep("done");
    } catch (err) {
      const [title, hint] = explainError((err as Error).message ?? String(err));
      setStep("error");
      setError({ title, hint });
    }
  }

  // Buying the stock token to pay with: the same window, one step aside.
  if (buying) {
    const row = radar?.rows.find((r) => r.mint === quoteMint) ?? null;
    return (
      <Modal ariaLabel={`Buy ${quoteSymbol}`} onClose={onClose}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => {
                setBuying(false);
                setRefresh((n) => n + 1);
              }}
              className="text-muted hover:text-ink inline-flex items-center gap-1 text-xs"
            >
              <ArrowLeft size={13} strokeWidth={2} />
              Back to {tokenLabel}
            </button>
            <p className="mt-1 text-lg leading-tight font-semibold">
              Buy {quoteSymbol}
            </p>
            <p className="text-muted text-sm">
              The stock token this curve is priced in. Buy it here, then trade
              the curve with it.
            </p>
          </div>
          <ModalClose />
        </div>
        <div className="mt-4">
          {radar && row ? (
            <BuyPanel
              embedded
              mint={row.mint}
              symbol={row.symbol}
              referencePhrase={radar.reference.phrase}
              phase={radar.phase.phase}
              ageMs={row.ageMs}
              liquidity={row.liquidity}
            />
          ) : radar ? (
            <p className="text-muted text-sm">
              {quoteSymbol} is not one of the stocks we list, so we cannot quote
              it here.{" "}
              <Link
                href={`/stock/${underlying}`}
                className="hover:text-ink underline underline-offset-4"
              >
                Open its page
              </Link>
              .
            </p>
          ) : (
            <div
              className="t-shimmer h-40 rounded-2xl bg-soft"
              aria-hidden="true"
            />
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal ariaLabel={`Trade ${tokenLabel} on its curve`} onClose={onClose}>
      {/* Who and where: the token, its curve and how far along it is */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PoolAvatar
            image={image}
            symbol={baseSymbol}
            name={baseName}
            size={44}
          />
          <div className="min-w-0">
            <p className="truncate text-lg leading-tight font-semibold">
              {baseName}
            </p>
            <p className="text-muted text-sm">
              {baseSymbol ? `${baseSymbol} · ` : ""}on a curve priced in{" "}
              {quoteSymbol}
            </p>
          </div>
        </div>
        <ModalClose />
      </div>
      <div className="mt-4 rounded-2xl bg-soft p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">
            {pct < 1 ? "<1" : pct}% to graduation
          </span>
          <span className="text-muted num">
            {fmtQuote(raisedQuote)} {quoteSymbol} raised
            {stockPrice ? ` ≈ ${formatUsd(raisedQuote * stockPrice, 0)}` : ""}
          </span>
        </div>
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white">
          <span
            className="block h-full rounded-full bg-blue"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </span>
      </div>

      {step === "done" && done ? (
        <div className="rise mt-4 rounded-2xl bg-ink p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue">
              <SuccessCheck size={22} />
            </span>
            <div>
              <p className="text-lg leading-tight font-semibold">
                {side === "buy"
                  ? `You hold ${tokenLabel} now.`
                  : "Sold back to the curve."}
              </p>
              <p className="text-on-dark-muted text-sm">
                {side === "buy"
                  ? `About ${fmtTok(done.out)} ${tokenLabel}.`
                  : `About ${fmtQuote(done.out)} ${quoteSymbol} back in your wallet.`}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <a
              href={`https://solscan.io/tx/${done.signature}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-white btn-sm flex-1"
            >
              View on Solscan
            </a>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm flex-1 border border-white/20 bg-transparent hover:bg-white/10"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Seg
              ariaLabel="Buy or sell"
              value={side}
              onChange={switchSide}
              options={[
                { id: "buy", label: `Buy with ${quoteSymbol}` },
                { id: "sell", label: `Sell ${tokenLabel}` },
              ]}
              className="w-full justify-between"
            />
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-2xl bg-soft px-4 py-3">
            <input
              type="text"
              inputMode="decimal"
              value={text}
              onChange={(e) => setTyped(e.target.value)}
              className="num w-full bg-transparent text-2xl font-semibold outline-none"
              aria-label={
                side === "buy"
                  ? `${quoteSymbol} to spend`
                  : `${tokenLabel} to sell`
              }
            />
            <span className="text-muted text-sm">
              {side === "buy" ? quoteSymbol : tokenLabel}
            </span>
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Shares of what the wallet holds, not dollar amounts: the price
                moves between the click and the trade, the balance does not. */}
            {balance ? (
              PARTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTyped(partOf(balance ?? 0, p))}
                  className="pill bg-soft text-ink hover:bg-line"
                >
                  {p === 1 ? "All" : `${p * 100}%`}
                </button>
              ))
            ) : side === "buy" && stockPrice ? (
              // No balance to divide up yet, so give a sense of size in dollars.
              USD_PRESETS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setTyped(spendFor(u, stockPrice))}
                  className="pill bg-soft text-ink hover:bg-line"
                >
                  {formatUsd(u, 0)}
                </button>
              ))
            ) : (
              <span />
            )}
            <span
              className={`num ml-auto text-xs ${short ? "text-down" : "text-muted"}`}
            >
              {side === "buy"
                ? quoteHeld != null
                  ? `you have ${fmtQuote(quoteHeld)} ${quoteSymbol}`
                  : stockPrice && valid
                    ? `≈ ${formatUsd(amount * stockPrice)}`
                    : ""
                : held != null
                  ? `you hold ${fmtTok(held)}`
                  : ""}
            </span>
          </div>

          {/* The quote: what comes out, at worst, and what the curve keeps */}
          <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
            {quoteError ? (
              <p className="text-sm text-white/80">{quoteError}</p>
            ) : !quote ? (
              <p className="text-on-dark-muted text-sm">
                {valid ? "Getting a quote from the curve…" : "Enter an amount."}
              </p>
            ) : (
              <>
                <p className="text-on-dark-muted text-xs">You get</p>
                <p className="num text-2xl font-semibold">
                  <SwapText
                    text={
                      side === "buy"
                        ? `${fmtTok(quote.amountOut)} ${tokenLabel}`
                        : `${fmtQuote(quote.amountOut)} ${quoteSymbol}`
                    }
                  />
                  {side === "sell" && stockPrice ? (
                    <span className="text-on-dark-muted text-base font-normal">
                      {" "}
                      ≈ {formatUsd(quote.amountOut * stockPrice)}
                    </span>
                  ) : null}
                </p>
                <div className="text-on-dark-muted num mt-3 grid grid-cols-3 gap-2 text-xs">
                  <span>
                    <span className="block text-white/50">At worst</span>
                    {side === "buy"
                      ? fmtTok(quote.minimumOut)
                      : fmtQuote(quote.minimumOut)}
                  </span>
                  <span>
                    <span className="block text-white/50">Curve fee</span>
                    {fmtQuote(quote.feeQuote)} {quoteSymbol}
                  </span>
                  <span>
                    <span className="block text-white/50">Curve after</span>
                    {quote.progressAfter != null
                      ? `${Math.round(quote.progressAfter * 100)}%`
                      : `${pct}%`}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            {!ready ? (
              <span className="btn w-full opacity-50">Checking wallets…</span>
            ) : !connected ? (
              <ConnectButton label="Connect wallet to trade" />
            ) : (
              <button
                type="button"
                className="btn w-full"
                disabled={busy || !quote}
                onClick={trade}
              >
                <SwapText
                  className={busy ? "t-shimmer" : ""}
                  text={
                    step === "building"
                      ? "Preparing…"
                      : step === "signing"
                        ? "Confirm in your wallet…"
                        : step === "confirming"
                          ? "Confirming onchain…"
                          : side === "buy"
                            ? `Buy ${tokenLabel}`
                            : `Sell ${tokenLabel}`
                  }
                />
              </button>
            )}
          </div>
          <p className="text-muted mt-2 text-xs">
            {side === "buy" ? (
              <>
                Paid in {quoteSymbol} from your wallet. None yet?{" "}
                <button
                  type="button"
                  onClick={() => setBuying(true)}
                  className="hover:text-ink underline underline-offset-4"
                >
                  Buy {quoteSymbol} first
                </button>
                .{" "}
              </>
            ) : null}
            A launch token on a curve is not a stock; it can go to zero.
          </p>
          {step === "error" && error && (
            <div
              key={error.title}
              className="rise t-shake mt-3 rounded-2xl border border-down/25 bg-soft-down p-4"
            >
              <div className="flex items-start gap-3">
                <span className="bg-down flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
                  <X size={16} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{error.title}</p>
                  <p className="text-muted mt-0.5 text-sm leading-relaxed">
                    {error.hint}
                  </p>
                </div>
              </div>
              {/* Short of the stock token: buy it here, then come back. */}
              {/\bnot enough\b/i.test(error.title + error.hint) && (
                <button
                  type="button"
                  onClick={() => setBuying(true)}
                  className="btn btn-sm mt-3 w-full"
                >
                  Buy {quoteSymbol}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/** Claims the creator fees of one pool; the connected wallet must be its creator. */
export function ClaimFeesButton({
  pool,
  label,
  role = "creator",
  className = "pill bg-soft-up text-up hover:bg-line",
  onDone,
}: {
  pool: string;
  label: string;
  role?: "creator" | "partner";
  className?: string;
  onDone?: (signature: string) => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const connected = useConnectedWallet(solanaClient);
  const busy =
    step === "building" || step === "signing" || step === "confirming";
  if (!connected?.signer) return null;
  async function claim() {
    if (!connected?.signer) return;
    try {
      setStep("building");
      const res = await fetch("/api/curves/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pool,
          action: "claim",
          role,
          owner: connected.account.address,
        }),
      });
      const b = (await res.json()) as { transaction?: string; error?: string };
      if (!res.ok || !b.transaction)
        throw new Error(b.error ?? "could not build the claim");
      setStep("signing");
      const sig = await signTx(connected.signer, b.transaction);
      setStep("confirming");
      await confirmOrThrow(sig);
      setStep("done");
      onDone?.(sig);
    } catch {
      setStep("error");
    }
  }
  return (
    <button
      type="button"
      onClick={claim}
      disabled={busy || step === "done"}
      className={className}
      title="Trading fees this curve earned for you, its creator"
    >
      {busy
        ? "Claiming…"
        : step === "done"
          ? "Claimed"
          : step === "error"
            ? "Try again"
            : label}
    </button>
  );
}
