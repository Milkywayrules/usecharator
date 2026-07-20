import path from "node:path";
import type { NextConfig } from "next";

// Web env: optional NEXT_PUBLIC_* vars with dev defaults only. Server secrets and
// strict runtime validation live in the API (@t3-oss/env-core in apps/api/src/config.ts).
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  async redirects() {
    return [
      {
        destination: "/icon.svg",
        permanent: false,
        source: "/favicon.ico",
      },
    ];
  },
  async rewrites() {
    const proxyApi =
      process.env.NODE_ENV === "development" || process.env.E2E === "1";
    const rules: { destination: string; source: string }[] = [];
    if (proxyApi) {
      rules.push({
        destination: `${apiOrigin}/api/:path*`,
        source: "/api/:path*",
      });
    }
    return rules;
  },
  transpilePackages: ["@charator/shared", "@charator/spec"],
};

export default nextConfig;
