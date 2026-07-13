/**
 * Deterministic PRNG (mulberry32).
 *
 * The whole dataset is generated from a fixed seed, so every reload — server or
 * client — produces byte-identical data. That keeps React hydration stable and
 * makes the mock backend behave like a real database with stable IDs.
 */
export function createRng(seed: number) {
  let a = seed >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Integer in [min, max] inclusive. */
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    /** Float in [min, max), rounded to `decimals`. */
    float(min: number, max: number, decimals = 1) {
      const value = next() * (max - min) + min;
      const f = 10 ** decimals;
      return Math.round(value * f) / f;
    },
    bool(probability = 0.5) {
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    /** `count` distinct members of `items` (or all of them, if fewer exist). */
    sample<T>(items: readonly T[], count: number): T[] {
      const pool = [...items];
      const out: T[] = [];
      const n = Math.min(count, pool.length);
      for (let i = 0; i < n; i++) {
        out.push(...pool.splice(Math.floor(next() * pool.length), 1));
      }
      return out;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Weighted pick — `weights` need not sum to 1. */
    weighted<T>(items: readonly T[], weights: readonly number[]): T {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

export type Rng = ReturnType<typeof createRng>;
