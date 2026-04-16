import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "MimirWell — Sovereign Encrypted Memory for AI Agents",
  description: "Zero-knowledge memory on Arweave + Ethereum. Your agent encrypts. We store what we can't read. You hold the kill switch.",
  keywords: ["AI agents", "Arweave", "encrypted memory", "zero-knowledge", "sovereign data", "Web3", "Ethereum", "AES-256-GCM"],
  openGraph: {
    title: "MimirWell — Sovereign Encrypted Memory for AI Agents",
    description: "Zero-knowledge memory on Arweave + Ethereum. Your agent encrypts. We store what we can't read. You hold the kill switch.",
    type: "website",
    url: "https://mimirwell.net",
    siteName: "MimirWell",
    images: [
      {
        url: "https://mimirwell.net/og-image.jpg",
        width: 1080,
        height: 1080,
        alt: "MimirWell — Sovereign Encrypted Memory for AI Agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MimirWell — Sovereign Encrypted Memory for AI Agents",
    description: "Zero-knowledge memory on Arweave + Ethereum. Your agent encrypts. We store what we can't read. You hold the kill switch.",
    images: ["https://mimirwell.net/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#0a0f1a]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
