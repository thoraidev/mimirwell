import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "MimirWell — Encrypted Sovereign Memory",
  description: "Your agent's memories live on Filecoin. The keys live on Lit Protocol. You hold the lock.",
  keywords: ["AI agents", "Filecoin", "Lit Protocol", "encrypted memory", "sovereign data", "Web3"],
  openGraph: {
    title: "MimirWell",
    description: "Encrypted sovereign memory for AI agents.",
    type: "website",
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
