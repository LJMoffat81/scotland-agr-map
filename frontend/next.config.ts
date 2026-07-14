import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Next 16 blocks HMR/dev assets when the page is opened on a different host
  // (localhost vs 127.0.0.1). Allow both so local browsing does not break.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // API proxy is app/backend/[...path]/route.ts (not rewrites).
  // Rewrites surface socket hang-ups as TypeError: Failed to fetch;
  // the route handler returns clean JSON 503 instead.
};

export default nextConfig;
