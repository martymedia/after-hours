import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalletViewLoader } from "@/components/wallet-view-loader";
import { shortAddress } from "@/lib/format";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Wallet ${shortAddress(address)}`,
    description: "Tokenized stocks held by this wallet, priced live onchain, with gains since purchase and recent trades.",
    robots: { index: false, follow: true },
  };
}

/** Read-only portfolio of any wallet: shareable, no connection needed. */
export default async function PublicWalletPage({ params }: Props) {
  const { address } = await params;
  if (!BASE58.test(address)) notFound();
  return <WalletViewLoader address={address} />;
}
