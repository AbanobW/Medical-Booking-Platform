import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * The MedPoint host. Server-side only — the browser never talks to it directly.
 */
const API_UPSTREAM = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://medpoint.intrazero.org"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  images: {
    /*
     * Provider photos and covers are SVG served from our own route handlers
     * (/api/avatar, /api/cover). Next's optimizer rejects SVG by default, and
     * there is nothing to optimize anyway — so pass them through untouched.
     */
    unoptimized: true,
  },

  /*
   * Proxy the MedPoint API through our own origin.
   *
   * MedPoint sends no `Access-Control-Allow-*` headers on any response, so a
   * browser blocks every cross-origin call to it — the request leaves, the
   * response is discarded, and the app sees an opaque network failure. Nothing
   * on the client can work around that; CORS is enforced by the browser and can
   * only be granted by the server.
   *
   * Rewriting through Next sidesteps it honestly: the browser makes a
   * same-origin request to /api/medpoint/*, Next forwards it server-to-server
   * (where CORS does not apply) and streams the response back. The Authorization
   * header rides along untouched.
   *
   * This is a workaround for a backend gap, not the end state — see
   * BACKEND-GAPS.md. Once MedPoint sends proper CORS headers this rewrite can go
   * away and the client can point straight at the API again.
   */
  async rewrites() {
    return [
      {
        source: "/api/medpoint/:path*",
        destination: `${API_UPSTREAM}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
