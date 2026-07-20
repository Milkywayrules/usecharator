import path from "node:path";
import type { NextConfig } from "next";

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
