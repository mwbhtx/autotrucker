import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static export for production builds only.
  ...(isProd ? { output: "export", trailingSlash: true } : {}),

  // Proxy /api requests to the NestJS backend during local development.
  // This is a no-op in production builds (output: 'export' ignores rewrites).
  ...(!isProd
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:3100/api/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
