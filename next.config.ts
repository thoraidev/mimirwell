import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep siwa external — avoids Turbopack trying to bundle optional peer deps
  serverExternalPackages: ["@buildersgarden/siwa"],
};

export default nextConfig;
