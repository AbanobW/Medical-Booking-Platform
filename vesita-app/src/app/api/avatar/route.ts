import { NextRequest } from "next/server";

/**
 * Deterministic SVG avatar generator.
 *
 * Keeps the project fully offline: no remote image hosts, no `next.config`
 * remotePatterns, no broken images when the network is down. The URL shape
 * (`/api/avatar?seed=…&name=…`) is what a real backend would hand back.
 */

const PALETTES: [string, string][] = [
  ["#0186D5", "#0B4F91"],
  ["#22C55E", "#15803D"],
  ["#3B82F6", "#1D4ED8"],
  ["#8B5CF6", "#6D28D9"],
  ["#F59E0B", "#B45309"],
  ["#EC4899", "#BE185D"],
  ["#14B8A6", "#0F766E"],
  ["#6366F1", "#4338CA"],
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initialsOf(name: string): string {
  const words = name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "V";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      default: return "&apos;";
    }
  });
}

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const seed = searchParams.get("seed") ?? "vesita";
  const name = searchParams.get("name") ?? "Vesita";
  const size = Math.min(Number(searchParams.get("size")) || 256, 512);

  const [from, to] = PALETTES[hash(seed) % PALETTES.length];
  const initials = escapeXml(initialsOf(name));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <circle cx="200" cy="56" r="88" fill="#ffffff" opacity="0.08"/>
  <circle cx="40" cy="220" r="64" fill="#000000" opacity="0.06"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif"
        font-size="96" font-weight="700" fill="#ffffff" opacity="0.95">${initials}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
