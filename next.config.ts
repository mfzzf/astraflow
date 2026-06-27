import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
