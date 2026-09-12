import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-xl font-semibold">We do not track that stock.</h1>
      <p className="text-muted mt-2 text-sm">
        Only stocks with real onchain liquidity are listed.
      </p>
      <Link href="/stocks" className="mt-6 inline-block text-sm underline">
        Back to all stocks
      </Link>
    </div>
  );
}
