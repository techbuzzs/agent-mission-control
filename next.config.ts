import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/Oracle needs a standalone server; Vercel supplies its own output tracing.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
