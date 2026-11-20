// Seeded random numbers — one small generator the whole game shares,
// so the world, the traffic and the screenshot scenes are reproducible
// from a single seed (the ?shot= scenes depend on this).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max]
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // one element of an array
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
  };
}

// Hash a short string into a 32-bit seed, so a named seed ("solmar")
// always builds the same city.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
