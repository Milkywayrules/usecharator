import path from "node:path";
import type { NextConfig } from "next";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    return [
      {
        destination: `${apiOrigin}/api/:path*`,
        source: "/api/:path*",
      },
    ];
  },
  transpilePackages: ["@charator/shared", "@charator/spec"],
};

export default nextConfig;
