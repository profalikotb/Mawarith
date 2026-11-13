/**
 * Evaluates a case with unresolved unknowns. An unknown is "immaterial" if
 * flipping it never changes any positive share under every combination of the
 * other unknowns; only material unknowns keep the result incomplete.
 */
import { calculateCase, type CaseResult } from "./calculate";
import { deriveCounts, type Assumptions, type UnknownItem } from "./derive";
import type { CaseInput } from "./types";

export interface Evaluation {
  result: CaseResult;
  material: UnknownItem[];
  immaterial: UnknownItem[];
  scenarios: { label: string; assumptions: Assumptions; result: CaseResult }[];
}

const MAX_ENUM = 6;

const signature = (r: CaseResult) =>
  JSON.stringify(
    r.persons
      .filter((p) => p.shareOfNet.isPos())
      .map((p) => [p.id, p.shareOfNet.toString()])
      .sort(),
  ) + JSON.stringify(r.issues.filter((i) => i.severity === "stop").map((i) => i.code).sort());

export function evaluateCase(input: CaseInput): Evaluation {
  const unknowns = deriveCounts(input).unknowns;
  if (!unknowns.length) return { result: calculateCase(input), material: [], immaterial: [], scenarios: [] };
  if (unknowns.length > MAX_ENUM) {
    const r = calculateCase(input);
    return { result: r, material: unknowns, immaterial: [], scenarios: [] };
  }
  const n = unknowns.length;
  const sig = new Map<number, string>();
  const res = new Map<number, CaseResult>();
  const asg = (mask: number): Assumptions => Object.fromEntries(unknowns.map((u, i) => [u.id, (mask & (1 << i)) !== 0]));
  for (let mask = 0; mask < 1 << n; mask++) {
    const r = calculateCase(input, asg(mask));
    res.set(mask, r);
    sig.set(mask, signature(r));
  }
  const materialIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    let matters = false;
    for (let mask = 0; mask < 1 << n && !matters; mask++) {
      if (mask & (1 << i)) continue;
      if (sig.get(mask) !== sig.get(mask | (1 << i))) matters = true;
    }
    if (matters) materialIdx.push(i);
  }
  const material = materialIdx.map((i) => unknowns[i]);
  const immaterial = unknowns.filter((_, i) => !materialIdx.includes(i));
  const baseAssume: Assumptions = Object.fromEntries(immaterial.map((u) => [u.id, false]));

  if (!material.length) {
    const r = calculateCase(input, baseAssume);
    r.issues.push({
      code: "UNKNOWN_IMMATERIAL",
      severity: "info",
      message: `لم يُحسم وجود: ${immaterial.map((u) => u.label).join("، ")} — ولا يؤثر ذلك في القسمة في هذه المسألة.`,
    });
    return { result: r, material, immaterial, scenarios: [] };
  }
  const r = calculateCase(input, baseAssume);
  r.unknowns = material;
  r.status = "incomplete";
  const scenarios: Evaluation["scenarios"] = [];
  const shown = material.slice(0, 3);
  for (let mask = 0; mask < 1 << shown.length; mask++) {
    const a: Assumptions = { ...baseAssume };
    const parts: string[] = [];
    shown.forEach((u, i) => {
      const yes = (mask & (1 << i)) !== 0;
      a[u.id] = yes;
      parts.push(`${u.label}: ${yes ? "موجود" : "غير موجود"}`);
    });
    material.slice(3).forEach((u) => (a[u.id] = false));
    scenarios.push({ label: parts.join(" — "), assumptions: a, result: calculateCase(input, a) });
  }
  return { result: r, material, immaterial, scenarios };
}
