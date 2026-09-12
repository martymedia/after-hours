import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "After Hours", template: "%s | After Hours" },
  description:
    "Stocks keep trading on Solana when Wall Street is closed. See which ones, how far the price has drifted, and whether it is fresh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
      </body>
    </html>
  );
}
