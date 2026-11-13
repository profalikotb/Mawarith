import { describe, it, expect } from "vitest";
import { Fraction, F, allocate, parseMoneyToPiasters, formatEGP } from "../src/engine";

describe("Fraction (BigInt exact)", () => {
  it("normalizes and does arithmetic exactly", () => {
    expect(F(2, 4).toString()).toBe("1/2");
    expect(F(1, 3).add(F(1, 6)).toString()).toBe("1/2");
    expect(F(1, 8).mul(F(2, 3)).toString()).toBe("1/12");
    expect(F(5, 24).div(F(1, 3)).toString()).toBe("5/8");
    expect(F(-1, -2).toString()).toBe("1/2");
    expect(F(1, 3).toPercent(2)).toBe("33.33");
    expect(F(2, 3).toPercent(2)).toBe("66.67");
  });
  it("handles very large values without precision loss", () => {
    const a = new Fraction(10n ** 30n + 1n, 3n);
    expect(a.mulInt(3).toString()).toBe((10n ** 30n + 1n).toString());
  });
});

describe("money", () => {
  it("parses Arabic and Latin digits", () => {
    expect(parseMoneyToPiasters("١٢٣٤٫٥")).toBe(123450n);
    expect(parseMoneyToPiasters("1,000.25")).toBe(100025n);
    expect(parseMoneyToPiasters("abc")).toBeNull();
    expect(formatEGP(123456789n)).toBe("1,234,567.89");
  });
  it("largest remainder keeps the exact total", () => {
    const m = allocate(100n, [
      { key: "a", order: 0, fraction: F(1, 3) },
      { key: "b", order: 1, fraction: F(1, 3) },
      { key: "c", order: 2, fraction: F(1, 3) },
    ]);
    expect([...m.values()].reduce((s, x) => s + x, 0n)).toBe(100n);
    expect(m.get("a")).toBe(34n);
  });
  it("never produces negative or lost piasters for many recipients", () => {
    const items = Array.from({ length: 17 }, (_, i) => ({ key: `k${i}`, order: i, fraction: F(1, 17) }));
    const m = allocate(1_000_001n, items);
    expect([...m.values()].reduce((s, x) => s + x, 0n)).toBe(1_000_001n);
    for (const v of m.values()) expect(v >= 0n).toBe(true);
  });
});
