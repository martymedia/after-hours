import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "After Hours", template: "%s | After Hours" },
  description:
    "Trade stocks when Wall Street sleeps. Tokenized stocks keep trading on Solana around the clock. See which ones, whether the price is real, and what a trade really costs.",
  // iOS Safari otherwise rewrites number-like text into tel: links before
  // React loads, which trips hydration on phones.
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: "#121214" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
