import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep siwa and turbo-sdk external — avoids Turbopack bundling issues with native deps
  serverExternalPackages: ["@buildersgarden/siwa", "@ardrive/turbo-sdk"],

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
