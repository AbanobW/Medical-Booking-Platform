import { NextRequest } from "next/server";

/**
 * Deterministic SVG cover/banner generator — the wide counterpart to
 * `/api/avatar`. Renders an abstract medical-themed gradient scene so provider
 * profiles have a real cover image without depending on a remote CDN.
 */

const THEMES: [string, string, string][] = [
  ["#0186D5", "#0B4F91", "#0F172A"],
  ["#0EA5E9", "#0369A1", "#0F172A"],
  ["#22C55E", "#15803D", "#052E16"],
  ["#8B5CF6", "#5B21B6", "#1E1B4B"],
  ["#14B8A6", "#0F766E", "#042F2E"],
  ["#F59E0B", "#B45309", "#1C1917"],
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG so each cover's blobs differ but stay stable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function GET(request: NextRequest) {
  const seed = request.nextUrl.searchParams.get("seed") ?? "vesita";
  const h = hash(seed);
  const [from, mid, to] = THEMES[h % THEMES.length];
  const next = rng(h);

  const blobs = Array.from({ length: 5 }, () => {
    const cx = Math.round(next() * 1200);
    const cy = Math.round(next() * 400);
    const r = Math.round(60 + next() * 180);
    const opacity = (0.05 + next() * 0.1).toFixed(3);
    const white = next() > 0.5;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${white ? "#ffffff" : "#000000"}" opacity="${opacity}"/>`;
  }).join("\n    ");

  // A faint ECG trace across the banner.
  const baseline = 300;
  const ecg = Array.from({ length: 6 }, (_, i) => {
    const x = i * 200;
    return `M ${x} ${baseline} h 60 l 14 -46 l 16 92 l 14 -46 h 96`;
  }).join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400" role="img" aria-label="Provider cover image">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="55%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="400" fill="url(#bg)"/>
  <g>
    ${blobs}
  </g>
  <path d="${ecg}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
