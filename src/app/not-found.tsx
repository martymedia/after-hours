import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Nothing here.</h1>
      <p className="text-muted mt-2 text-sm">
        That stock, wallet or trade is not on After Hours. Only stocks with real
        onchain liquidity are listed.
      </p>
      <Link href="/stocks" className="btn mt-6">
        Back to all stocks
      </Link>
    </div>
  );
}
