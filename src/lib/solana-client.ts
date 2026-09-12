"use client";

// One Kit client for the browser: Wallet Standard discovery plus an RPC to
// send signed transactions. Built once at module scope.

import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export const solanaClient = createClient()
  .use(walletSigner({ chain: "solana:mainnet" }))
  .use(solanaRpc({ rpcUrl }));

export type SolanaClient = typeof solanaClient;
