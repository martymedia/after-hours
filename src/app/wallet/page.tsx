import type { Metadata } from "next";
import { WalletViewLoader } from "@/components/wallet-view-loader";

export const metadata: Metadata = { title: "Wallet" };

/** Portfolio of the connected wallet. Everything happens client-side once a wallet is known. */
export default function WalletPage() {
  return <WalletViewLoader />;
}
