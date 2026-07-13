import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
     * Provider photos and covers are SVG served from our own route handlers
     * (/api/avatar, /api/cover). Next's optimizer rejects SVG by default, and
     * there is nothing to optimize anyway — so pass them through untouched.
     */
    unoptimized: true,
  },
};

export default nextConfig;
