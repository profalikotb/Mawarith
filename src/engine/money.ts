import { Fraction } from "./fraction";

/** Parse a user-typed money string (EGP, Arabic or Latin digits, optional decimals) into piasters. */
export function parseMoneyToPiasters(input: string): bigint | null {
  if (input == null) return null;
  const s = toLatinDigits(String(input))
    .replace(/[,\s،]/g, "")
    .replace(/٫/g, ".")
    .trim();
  if (!s) return 0n;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [i, d = ""] = s.split(".");
  return BigInt(i) * 100n + BigInt((d + "00").slice(0, 2));
}

export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

export function toArabicDigits(s: string): string {
  return s.replace(/\d/g, (c) => String.fromCharCode(0x0660 + Number(c)));
}

export function pi(s: string | undefined | null): bigint {
  if (!s) return 0n;
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/** Format piasters as EGP with thousands separators. */
export function formatEGP(p: bigint, arabicDigits = false): string {
  const neg = p < 0n;
  const v = neg ? -p : p;
  const pounds = (v / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const pt = (v % 100n).toString().padStart(2, "0");
  let out = `${neg ? "-" : ""}${pounds}.${pt}`;
  if (arabicDigits) out = toArabicDigits(out).replace(/,/g, "٬").replace(/\./g, "٫");
  return out;
}

export interface AllocItem {
  key: string;
  order: number; // deterministic tie-break
  fraction: Fraction; // of total
}

/**
 * Largest-remainder allocation of an integer amount (piasters) according to
 * exact fractions. Guarantees Σ allocated = total exactly when Σ fractions = 1.
 */
export function allocate(total: bigint, items: AllocItem[]): Map<string, bigint> {
  const res = new Map<string, bigint>();
  if (total <= 0n || !items.length) {
    for (const it of items) res.set(it.key, 0n);
    return res;
  }
  const sumFrac = Fraction.sum(items.map((i) => i.fraction));
  const target = sumFrac.mul(new Fraction(total));
  // only allocate whole piasters of the exact target (floor) — normally sumFrac = 1
  const targetInt = target.n / target.d;
  const rem: { key: string; order: number; r: Fraction }[] = [];
  let used = 0n;
  for (const it of items) {
    const exact = it.fraction.mul(new Fraction(total));
    const fl = exact.n / exact.d;
    res.set(it.key, fl);
    used += fl;
    rem.push({ key: it.key, order: it.order, r: exact.sub(new Fraction(fl)) });
  }
  let left = targetInt - used;
  rem.sort((a, b) => b.r.cmp(a.r) || a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (let i = 0; left > 0n && i < rem.length; i++, left--) {
    res.set(rem[i].key, res.get(rem[i].key)! + 1n);
  }
  return res;
}
