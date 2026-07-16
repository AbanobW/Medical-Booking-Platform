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
     * A provider's photo, when the API has one, is whatever URL MedPoint's
     * `avatar_url` returns — a host we don't control and haven't configured
     * `remotePatterns` for. Next's optimizer refuses to fetch from an
     * unconfigured host at runtime, so this stays `true` until that host is
     * known and added. There is no local placeholder-image route generating
     * avatars any more; a missing photo renders initials instead (see
     * `initialsOf` at each call site), not a fabricated image.
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
