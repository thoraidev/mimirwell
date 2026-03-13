import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Treat SIWA and viem as server-side externals — don't bundle them with Turbopack.
  // This avoids pulling in optional peer deps (Circle, Openfort) that aren't installed.
  serverExternalPackages: ["@buildersgarden/siwa", "viem"],
};

export default nextConfig;
