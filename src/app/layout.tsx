import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from "@/lib/brand";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: `${TAGLINE} ${DESCRIPTION}`,
  applicationName: SITE_NAME,
  keywords: ["tokenized stocks", "Solana", "xStocks", "after hours trading", "Backpack Securities", "Ondo Global Markets", "buy stocks with USDC", "24/7 stock trading"],
  category: "finance",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url: "/", title: `${SITE_NAME}: ${TAGLINE}`, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${SITE_NAME}: ${TAGLINE}`, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  // iOS Safari otherwise rewrites number-like text into tel: links before
  // React loads, which trips hydration on phones.
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: "#121214" };

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/apple-icon`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: `${TAGLINE} ${DESCRIPTION}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <script
          type="application/ld+json"
          // Static, hand-written structured data; nothing user-provided goes in here.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
