import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pg-boss", "sharp"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
