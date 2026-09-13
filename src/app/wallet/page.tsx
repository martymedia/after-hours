import type { Metadata } from "next";
import { WalletViewLoader } from "@/components/wallet-view-loader";

export const metadata: Metadata = { title: "Wallet", description: "Your tokenized stocks, gains since purchase and recent trades, read live from your wallet.", robots: { index: false, follow: true } };

/** Portfolio of the connected wallet. Everything happens client-side once a wallet is known. */
export default function WalletPage() {
  return <WalletViewLoader />;
}
