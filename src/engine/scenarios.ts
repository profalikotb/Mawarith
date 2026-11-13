import { Fraction } from "./fraction";
import { calculateCase, type CaseResult } from "./calculate";
import { deriveCounts, type Assumptions, type UnknownItem } from "./derive";
import type { CaseInput, Descendant } from "./types";

export interface Scenario {
  label: string;
  assumptions: Assumptions;
  result: CaseResult;
}

/** Enumerate scenarios for up to `max` unresolved unknowns (2^n). */
export function unknownScenarios(input: CaseInput, max = 3): { unknowns: UnknownItem[]; scenarios: Scenario[]; truncated: boolean } {
  const unknowns = deriveCounts(input).unknowns;
  const list = unknowns.slice(0, max);
  const scenarios: Scenario[] = [];
  const n = list.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const a: Assumptions = {};
    const parts: string[] = [];
    list.forEach((u, i) => {
      const yes = (mask & (1 << i)) !== 0;
      a[u.id] = yes;
      parts.push(`${u.label}: ${yes ? "موجود" : "غير موجود"}`);
    });
    // unknowns beyond max are assumed absent only for illustration, and flagged
    unknowns.slice(max).forEach((u) => (a[u.id] = false));
    scenarios.push({ label: parts.join(" — "), assumptions: a, result: calculateCase(input, a) });
  }
  return { unknowns, scenarios, truncated: unknowns.length > max };
}

export interface PregnancyView {
  male: CaseResult;
  female: CaseResult;
  rows: { id: string; label: string; ifMale: Fraction; ifFemale: Fraction; immediate: Fraction }[];
  reserved: Fraction; // fraction of N held for the unborn
}

/**
 * Art. 42: reserve for the unborn the larger of the two shares (male/female);
 * every other claimant receives now the lesser of their two shares.
 */
export function pregnancyScenarios(input: CaseInput, assumptions: Assumptions = {}): PregnancyView {
  const mk = (gender: "male" | "female"): CaseInput => {
    const c: CaseInput = JSON.parse(JSON.stringify(input));
    const unborn: Descendant = { id: "unborn", name: "الحمل", gender, status: "alive", children: [] };
    c.family.children.push(unborn);
    c.flags.pregnancy = "no";
    return c;
  };
  const male = calculateCase(mk("male"), assumptions);
  const female = calculateCase(mk("female"), assumptions);
  const ids = new Set([...male.persons, ...female.persons].map((p) => p.id));
  const get = (r: CaseResult, id: string) => r.persons.find((p) => p.id === id);
  const rows: PregnancyView["rows"] = [];
  let immediateSum = Fraction.ZERO;
  for (const id of ids) {
    if (id === "unborn") continue;
    const a = get(male, id);
    const b = get(female, id);
    const im = (a?.shareOfNet ?? Fraction.ZERO).min(b?.shareOfNet ?? Fraction.ZERO);
    immediateSum = immediateSum.add(im);
    rows.push({
      id,
      label: (a || b)!.name ? `${(a || b)!.name} (${(a || b)!.relation})` : (a || b)!.relation,
      ifMale: a?.shareOfNet ?? Fraction.ZERO,
      ifFemale: b?.shareOfNet ?? Fraction.ZERO,
      immediate: im,
    });
  }
  return { male, female, rows, reserved: Fraction.ONE.sub(immediateSum) };
}
