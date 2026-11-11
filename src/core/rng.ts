/** Детерминированный ГПСЧ sfc32 с сериализуемым состоянием. */
export interface Rng {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function createRng(seed: number): Rng {
  // splitmix32 разворачивает сид в 4 слова
  let s = seed >>> 0;
  const mix = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const r: Rng = { a: mix(), b: mix(), c: mix(), d: mix() };
  for (let i = 0; i < 12; i++) nextFloat(r);
  return r;
}

export function nextU32(r: Rng): number {
  const t = (((r.a + r.b) >>> 0) + r.d) >>> 0;
  r.d = (r.d + 1) >>> 0;
  r.a = r.b ^ (r.b >>> 9);
  r.b = (r.c + (r.c << 3)) >>> 0;
  r.c = ((r.c << 21) | (r.c >>> 11)) >>> 0;
  r.c = (r.c + t) >>> 0;
  return t;
}

/** [0, 1) */
export function nextFloat(r: Rng): number {
  return nextU32(r) / 4294967296;
}

export const range = (r: Rng, a: number, b: number): number => a + nextFloat(r) * (b - a);
export const int = (r: Rng, n: number): number => Math.floor(nextFloat(r) * n);
export const chance = (r: Rng, p: number): boolean => nextFloat(r) < p;

/** Независимый поток, производный от родительского. */
export function fork(r: Rng): Rng {
  return createRng(nextU32(r));
}
