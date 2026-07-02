import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",                 // static HTML → out/
  images: { unoptimized: true },    // required: static export has no image server
  trailingSlash: true,              // clean Pages routing for nested paths
};

export default nextConfig;
