import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/docs": ["./openapi/modelverse-api-protocol-docs/openapi/**/*"],
    "/docs/**/*": ["./openapi/modelverse-api-protocol-docs/openapi/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "astraflow.ucloud.cn",
        pathname: "/static/**",
      },
    ],
  },
};

export default nextConfig;
