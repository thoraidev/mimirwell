import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep siwa external — avoids Turbopack trying to bundle optional peer deps
  serverExternalPackages: ["@buildersgarden/siwa"],

  // Serve /AGENT.md at root for agent discovery
  async rewrites() {
    return [
      {
        source: "/AGENT.md",
        destination: "/api/agent-md",
      },
    ];
  },
};

export default nextConfig;
