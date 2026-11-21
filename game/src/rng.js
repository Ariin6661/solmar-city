// Solmar City — deterministic randomness.
//
// The city, the traffic and the mission pickups all come from a seeded
// generator, so a screenshot staged with ?seed=7 looks the same every
// time. mulberry32 is small, fast and good enough for a game; the helpers
// below are the only random calls the rest of the code makes.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max] inclusive.
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// One element of an array, uniformly.
export function pick(rng, arr) {
  // Defensive: an empty list has nothing to pick from.
  if (!arr.length) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

// A shuffled copy of an array (Fisher-Yates, driven by the same rng).
export function shuffled(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// True with probability p (0..1).
export function chance(rng, p) {
  return rng() < p;
}
