/** 再現可能な疑似乱数（mulberry32）。計算問題の生成や出題順に使う */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  if (arr.length === 0) throw new RangeError('empty array');
  return arr[Math.floor(rng() * arr.length)]!;
}

/** min〜max（両端含む）の step 刻みの整数 */
export function randInt(rng: () => number, min: number, max: number, step = 1): number {
  const n = Math.floor((max - min) / step) + 1;
  return min + Math.floor(rng() * n) * step;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
