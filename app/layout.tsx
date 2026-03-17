import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "MimirWell — Encrypted Sovereign Memory",
  description: "Your agent encrypts locally. We store what we can't read. You hold the kill switch. Zero-knowledge agent memory on Filecoin + Ethereum.",
  keywords: ["AI agents", "Filecoin", "encrypted memory", "zero-knowledge", "sovereign data", "Web3", "Ethereum", "AES-256-GCM"],
  openGraph: {
    title: "MimirWell — Encrypted Sovereign Memory",
    description: "Your agent encrypts locally. We store what we can't read. You hold the kill switch. Zero-knowledge agent memory on Filecoin + Ethereum.",
    type: "website",
    url: "https://mimirwell.net",
    siteName: "MimirWell",
    images: [
      {
        url: "https://mimirwell.net/og-image.jpg",
        width: 1080,
        height: 1080,
        alt: "MimirWell — Encrypted Sovereign Memory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MimirWell — Encrypted Sovereign Memory",
    description: "Your agent encrypts locally. We store what we can't read. You hold the kill switch. Zero-knowledge agent memory on Filecoin + Ethereum.",
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
