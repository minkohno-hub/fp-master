/**
 * BigInt による厳密な有理数演算。金額・利回り・係数の計算で浮動小数点誤差を避ける。
 */
export class Frac {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    if (d === 0n) throw new RangeError('division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = g === 0n ? 0n : n / g;
    this.d = g === 0n ? 1n : d / g;
  }

  static of(value: number | bigint | string, den: number | bigint = 1): Frac {
    if (typeof value === 'bigint') return new Frac(value, BigInt(den));
    const s = String(value);
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new RangeError(`invalid decimal: ${s}`);
    const [ip, fp = ''] = s.split('.');
    const scale = 10n ** BigInt(fp.length);
    const n = BigInt(`${ip}${fp}`);
    return new Frac(n, scale * BigInt(den));
  }

  add(o: Frac | number): Frac {
    const b = toFrac(o);
    return new Frac(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: Frac | number): Frac {
    const b = toFrac(o);
    return new Frac(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(o: Frac | number): Frac {
    const b = toFrac(o);
    return new Frac(this.n * b.n, this.d * b.d);
  }
  div(o: Frac | number): Frac {
    const b = toFrac(o);
    return new Frac(this.n * b.d, this.d * b.n);
  }
  pow(k: number): Frac {
    let r = Frac.of(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  cmp(o: Frac | number): number {
    const b = toFrac(o);
    const l = this.n * b.d;
    const r = b.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  min(o: Frac | number): Frac {
    return this.cmp(o) <= 0 ? this : toFrac(o);
  }
  max(o: Frac | number): Frac {
    return this.cmp(o) >= 0 ? this : toFrac(o);
  }

  /**
   * 小数第 decimals 位に丸めた値を返す（decimals が負なら 10^-decimals 単位）。
   * mode: half-up=四捨五入, floor=切捨て（負の方向）, ceil=切上げ, trunc=0方向
   */
  round(decimals: number, mode: RoundMode = 'half-up'): Frac {
    const scale = decimals >= 0 ? 10n ** BigInt(decimals) : 1n;
    const unit = decimals < 0 ? 10n ** BigInt(-decimals) : 1n;
    // x * scale / unit を整数に丸める
    const num = this.n * scale;
    const den = this.d * unit;
    const q = divRound(num, den, mode);
    return new Frac(q * unit, scale);
  }

  toNumber(): number {
    // 表示用。有限小数は文字列経由で正確に変換する
    return Number(this.toDecimalString(12));
  }

  /** 小数第 maxDecimals 位までの文字列（末尾の0は除去、四捨五入） */
  toDecimalString(maxDecimals = 10): string {
    const r = this.round(maxDecimals);
    const neg = r.n < 0n;
    const abs = neg ? -r.n : r.n;
    const scale = 10n ** BigInt(maxDecimals);
    const scaled = (abs * scale) / r.d;
    const ip = scaled / scale;
    let fp = (scaled % scale).toString().padStart(maxDecimals, '0').replace(/0+$/, '');
    if (maxDecimals === 0) fp = '';
    return `${neg && scaled !== 0n ? '-' : ''}${ip}${fp ? `.${fp}` : ''}`;
  }
}

export type RoundMode = 'half-up' | 'floor' | 'ceil' | 'trunc';

function toFrac(x: Frac | number): Frac {
  return x instanceof Frac ? x : Frac.of(x);
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

function divRound(num: bigint, den: bigint, mode: RoundMode): bigint {
  // den > 0
  const q = num / den; // 0方向
  const r = num % den;
  if (r === 0n) return q;
  const neg = num < 0n;
  switch (mode) {
    case 'trunc':
      return q;
    case 'floor':
      return neg ? q - 1n : q;
    case 'ceil':
      return neg ? q : q + 1n;
    case 'half-up': {
      const twice = (r < 0n ? -r : r) * 2n;
      if (twice >= den) return neg ? q - 1n : q + 1n;
      return q;
    }
  }
}

/** 数値を3桁区切りの日本語表記に */
export function yen(n: number | Frac): string {
  const v = n instanceof Frac ? n.toNumber() : n;
  return `${v.toLocaleString('ja-JP')}円`;
}

/** 金額表記（万円単位が割り切れれば万円で） */
export function manYen(n: number): string {
  if (n % 10000 === 0) return `${(n / 10000).toLocaleString('ja-JP')}万円`;
  return yen(n);
}
