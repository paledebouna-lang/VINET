import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // A listing carries up to 8 photos of 8 MB; the default limit is 1 MB.
    serverActions: { bodySizeLimit: "66mb" },
  },
};

export default nextConfig;
