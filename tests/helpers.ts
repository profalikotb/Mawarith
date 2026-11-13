import { emptyCase, computeShares, Fraction, type HeirCounts, type CaseInput, type Descendant } from "../src/engine";

export function counts(p: Partial<Omit<HeirCounts, "desc" | "gm">> & { desc?: [number, number][]; gm?: Partial<HeirCounts["gm"]> } = {}): HeirCounts {
  const base: HeirCounts = {
    husband: 0, wives: 0, father: 0, mother: 0, gf: 0,
    gm: { mm: 0, fm: 0, mmm: 0, fmm: 0, ffm: 0 },
    desc: Array.from({ length: 6 }, () => ({ sons: 0, daughters: 0 })),
    fullB: 0, fullS: 0, patB: 0, patS: 0, matB: 0, matS: 0,
    fullN: 0, patN: 0, fullNS: 0, patNS: 0, fullU: 0, patU: 0, fullC: 0, patC: 0, fullCS: 0, patCS: 0,
    distantKin: false,
  };
  const { desc, gm, ...rest } = p;
  Object.assign(base, rest);
  if (gm) Object.assign(base.gm, gm);
  (desc || []).forEach(([s, d], i) => (base.desc[i] = { sons: s, daughters: d }));
  return base;
}

/** map group key -> per-person share string */
export function shares(h: HeirCounts) {
  const r = computeShares(h);
  const m: Record<string, string> = {};
  for (const g of r.groups) m[g.key] = g.perPerson.toString();
  return { r, m };
}

export const fr = (s: string) => Fraction.parse(s);

let n = 0;
export const kid = (gender: "male" | "female", status: Descendant["status"] = "alive", children: Descendant[] = [], name?: string, gift?: string): Descendant => ({
  id: `k${++n}`,
  name,
  gender,
  status,
  children,
  giftPiasters: gift,
});

/** a fully-determined case (no unknowns) */
export function baseCase(gender: "male" | "female" = "male"): CaseInput {
  const c = emptyCase(false);
  c.meta.deceasedGender = gender;
  c.meta.confirmDeceased = true;
  c.meta.deathDate = "2025-01-01";
  c.family.otherRelative = "no";
  c.estate.fractionOnly = true;
  return c;
}

export function personMap(res: { persons: { id: string; shareOfNet: Fraction; amount?: bigint }[] }) {
  const m: Record<string, string> = {};
  for (const p of res.persons) m[p.id] = p.shareOfNet.toString();
  return m;
}
