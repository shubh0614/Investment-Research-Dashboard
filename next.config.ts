import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker — copies only the files needed to run
  // the app, including node_modules. Required by the Dockerfile.
  output: "standalone",
};

export default nextConfig;
