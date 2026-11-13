/**
 * Exact rational arithmetic on BigInt. No floating point is used anywhere
 * in share computation. Fractions are always normalized (gcd-reduced,
 * positive denominator).
 */

const abs = (a: bigint) => (a < 0n ? -a : a);

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return abs(a / gcd(a, b) * b);
}

export class Fraction {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n);
    let dd = BigInt(d);
    if (dd === 0n) throw new Error("Fraction: zero denominator");
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(nn, dd) || 1n;
    this.n = nn / g;
    this.d = dd / g;
  }

  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);

  static of(n: number | bigint, d: number | bigint = 1): Fraction {
    return new Fraction(BigInt(n), BigInt(d));
  }

  /** Parse "a/b" or integer string. */
  static parse(s: string): Fraction {
    const t = s.trim();
    if (t.includes("/")) {
      const [a, b] = t.split("/");
      return new Fraction(BigInt(a.trim()), BigInt(b.trim()));
    }
    return new Fraction(BigInt(t), 1n);
  }

  add(o: Fraction): Fraction {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Fraction): Fraction {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Fraction): Fraction {
    return new Fraction(this.n * o.n, this.d * o.d);
  }
  div(o: Fraction): Fraction {
    if (o.n === 0n) throw new Error("Fraction: division by zero");
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  mulInt(k: number | bigint): Fraction {
    return new Fraction(this.n * BigInt(k), this.d);
  }
  divInt(k: number | bigint): Fraction {
    return new Fraction(this.n, this.d * BigInt(k));
  }
  cmp(o: Fraction): number {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: Fraction): boolean {
    return this.n === o.n && this.d === o.d;
  }
  lt(o: Fraction) {
    return this.cmp(o) < 0;
  }
  gt(o: Fraction) {
    return this.cmp(o) > 0;
  }
  lte(o: Fraction) {
    return this.cmp(o) <= 0;
  }
  gte(o: Fraction) {
    return this.cmp(o) >= 0;
  }
  isZero() {
    return this.n === 0n;
  }
  isNeg() {
    return this.n < 0n;
  }
  isPos() {
    return this.n > 0n;
  }
  min(o: Fraction) {
    return this.lte(o) ? this : o;
  }
  max(o: Fraction) {
    return this.gte(o) ? this : o;
  }

  toString(): string {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }

  toJSON(): string {
    return this.toString();
  }

  /** Percentage string with fixed decimals, computed with integer math (display only). */
  toPercent(decimals = 2): string {
    const scale = 10n ** BigInt(decimals);
    const num = this.n * 100n * scale;
    // round half up
    const q = (num * 2n + this.d) / (2n * this.d);
    const intPart = q / scale;
    const frac = (q % scale).toString().padStart(decimals, "0");
    return decimals > 0 ? `${intPart}.${frac}` : `${intPart}`;
  }

  static sum(list: Fraction[]): Fraction {
    return list.reduce((a, b) => a.add(b), Fraction.ZERO);
  }
}

export const F = (n: number | bigint, d: number | bigint = 1) => Fraction.of(n, d);
