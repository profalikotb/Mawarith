/**
 * End-to-end reference cases, including published Egyptian fatwas on the
 * obligatory bequest (الوصية الواجبة). Sources are recorded per case.
 */
import { describe, it, expect } from "vitest";
import { calculateCase, pregnancyScenarios, unknownScenarios, parseCaseText, applyTakharuj, Fraction, F } from "../src/engine";
import { baseCase, kid, personMap } from "./helpers";

const DAR_IFTA_3228 = "https://www.dar-alifta.org/ar/Fatwa/Details/12421";
const FATAWA_ARCHIVE = "https://archive.org/download/ftawi_misr/23.pdf";

describe("الوصية الواجبة — published Egyptian fatwas", () => {
  it(`Dar al-Ifta fatwa 3228 (1981): agnate grandson who gets nothing due to awl still takes wajiba 5/24 — ${DAR_IFTA_3228}`, () => {
    const c = baseCase("female");
    c.family.husband.state = "yes";
    c.family.father.state = "yes";
    c.family.mother.state = "yes";
    const gs = kid("male", "alive", [], "ابن الابن");
    c.family.children = [kid("female"), kid("female"), kid("male", "predeceased", [gs], "الابن المتوفى")];
    const r = calculateCase(c);
    expect(r.wajiba.total.toString()).toBe("5/24");
    const m = personMap(r);
    expect(m[`wajiba:${gs.id}`]).toBe("5/24");
    expect(m.husband).toBe("19/120");
    expect(m.father).toBe("19/180");
    expect(m.mother).toBe("19/180");
    expect(r.balanceOk).toBe(true);
  });

  it(`fatwa 219 (6/10/1955): two predeceased sons' branches capped at the third, 2/12 each — ${FATAWA_ARCHIVE}`, () => {
    const c = baseCase("male");
    c.family.wives = { state: "yes", list: [{ id: "w1", status: "married" }] };
    const bintIbn = kid("female", "alive", [], "بنت الابن");
    const bintIbnIbn = kid("female", "alive", [], "بنت ابن الابن");
    c.family.children = [
      kid("male", "alive", [], "الابن"),
      kid("female", "alive", [], "البنت"),
      kid("male", "predeceased", [bintIbn], "ابن متوفى أ"),
      kid("male", "predeceased", [kid("male", "predeceased", [bintIbnIbn])], "ابن متوفى ج"),
    ];
    const r = calculateCase(c);
    expect(r.wajiba.capApplied).toBe(true);
    const m = personMap(r);
    expect(m[`wajiba:${bintIbn.id}`]).toBe("1/6");
    expect(m[`wajiba:${bintIbnIbn.id}`]).toBe("1/6");
    expect(m.w1).toBe("1/12"); // 1/8 of the remaining 8/12
  });

  it(`fatwa 520 (14/12/1955): son + predeceased son's son → 1/3 wajiba, 2/3 son — ${FATAWA_ARCHIVE}`, () => {
    const c = baseCase("male");
    const g = kid("male");
    const son = kid("male");
    c.family.children = [son, kid("male", "predeceased", [g])];
    const r = calculateCase(c);
    const m = personMap(r);
    expect(m[`wajiba:${g.id}`]).toBe("1/3");
    expect(m[son.id]).toBe("2/3");
  });

  it(`fatwa 526 (3/4/1957): maternal sister + predeceased daughter's children → 3/9 wajiba split 2:1, rest to sister by fard and radd — ${FATAWA_ARCHIVE}`, () => {
    const c = baseCase("male");
    c.family.matSisters = { state: "yes", count: 1, names: [] };
    const s = kid("male");
    const d = kid("female");
    c.family.children = [kid("female", "predeceased", [s, d])];
    const r = calculateCase(c);
    const m = personMap(r);
    expect(m[`wajiba:${s.id}`]).toBe("2/9");
    expect(m[`wajiba:${d.id}`]).toBe("1/9");
    expect(m["matS#1"]).toBe("2/3");
  });

  it("daughter's line: only the first layer is entitled", () => {
    const c = baseCase("male");
    c.family.children = [kid("male"), kid("female", "predeceased", [kid("female", "predeceased", [kid("male")])])];
    const r = calculateCase(c);
    expect(r.wajiba.applies).toBe(false);
  });

  it("an heir descendant is not entitled to wajiba (son's daughter with a daughter)", () => {
    const c = baseCase("male");
    c.family.fullBrothers = { state: "yes", count: 1, names: [] };
    c.family.children = [kid("female"), kid("male", "predeceased", [kid("female")])];
    const r = calculateCase(c);
    expect(r.wajiba.applies).toBe(false);
    expect(r.persons.find((p) => p.groupKey === "desc2_f")!.shareOfNet.toString()).toBe("1/6");
  });

  it("gift without consideration is deducted from the wajiba (money mode)", () => {
    const c = baseCase("male");
    c.estate.fractionOnly = false;
    c.estate.assets = [{ id: "a", kind: "cash", label: "نقدية", valuePiasters: "30000000", ownership: "1" }]; // 300,000 EGP
    const g = kid("male", "alive", [], "حفيد", "5000000"); // 50,000 EGP gifted
    c.family.children = [kid("male"), kid("male", "predeceased", [g])];
    const r = calculateCase(c);
    const w = r.persons.find((p) => p.id === `wajiba:${g.id}`)!;
    expect(w.amount).toBe(5000000n); // 100,000 entitlement − 50,000 gift
    expect(r.persons.reduce((s, p) => s + (p.amount ?? 0n), 0n)).toBe(30000000n);
  });
});

describe("estate & wills", () => {
  it("insolvent estate produces no positive amounts", () => {
    const c = baseCase("male");
    c.estate.fractionOnly = false;
    c.estate.assets = [{ id: "a", kind: "cash", label: "نقدية", valuePiasters: "1000000", ownership: "1" }];
    c.estate.debts = [{ id: "d", kind: "debt", label: "قرض", amountPiasters: "1500000", proven: true }];
    c.estate.wills = [{ id: "w", beneficiary: "جمعية", beneficiaryIsHeir: false, beneficiaryIsWajibaEntitled: false, mode: "fraction", fraction: "1/3" }];
    c.family.children = [kid("male")];
    const r = calculateCase(c);
    expect(r.estate.insolvent).toBe(true);
    expect(r.persons.every((p) => (p.amount ?? 0n) === 0n)).toBe(true);
    expect(r.wills.executedTotal.isZero()).toBe(true);
  });

  it("optional will above the third is cut to the third without consent", () => {
    const c = baseCase("male");
    c.estate.fractionOnly = false;
    c.estate.assets = [{ id: "a", kind: "cash", label: "نقدية", valuePiasters: "9000000", ownership: "1" }];
    c.estate.wills = [{ id: "w", beneficiary: "أجنبي", beneficiaryIsHeir: false, beneficiaryIsWajibaEntitled: false, mode: "amount", amountPiasters: "4000000" }];
    c.family.children = [kid("male")];
    const r = calculateCase(c);
    expect(r.persons.find((p) => p.id === "will:w")!.amount).toBe(3000000n);
  });

  it("wajiba takes priority and reduces the room for optional wills (art. 78)", () => {
    const c = baseCase("male");
    const g = kid("male");
    c.family.children = [kid("male"), kid("male", "predeceased", [g])];
    c.estate.wills = [{ id: "w", beneficiary: "جمعية", beneficiaryIsHeir: false, beneficiaryIsWajibaEntitled: false, mode: "fraction", fraction: "1/4" }];
    const r = calculateCase(c);
    expect(r.wajiba.total.toString()).toBe("1/3");
    expect(r.wills.executedTotal.toString()).toBe("0");
  });

  it("joint ownership: only the decedent's share enters the estate", () => {
    const c = baseCase("male");
    c.estate.fractionOnly = false;
    c.estate.assets = [{ id: "h", kind: "realestate", label: "شقة", valuePiasters: "100000000", ownership: "1/2" }];
    c.family.children = [kid("male")];
    const r = calculateCase(c);
    expect(r.estate.netBeforeWills).toBe(50000000n);
  });

  it("unproven deferred mahr is not deducted automatically", () => {
    const c = baseCase("male");
    c.estate.fractionOnly = false;
    c.estate.assets = [{ id: "a", kind: "cash", label: "نقدية", valuePiasters: "1000000", ownership: "1" }];
    c.estate.debts = [{ id: "m", kind: "deferred_mahr", label: "مؤخر صداق", amountPiasters: "200000", proven: false }];
    c.family.children = [kid("male")];
    const r = calculateCase(c);
    expect(r.estate.netBeforeWills).toBe(1000000n);
    expect(r.issues.some((i) => i.code === "DEBT_UNPROVEN")).toBe(true);
  });

  it("rounding: 1 EGP among 3 sons keeps every piaster", () => {
    const c = baseCase("male");
    c.estate.fractionOnly = false;
    c.estate.assets = [{ id: "a", kind: "cash", label: "نقدية", valuePiasters: "100", ownership: "1" }];
    c.family.children = [kid("male"), kid("male"), kid("male")];
    const r = calculateCase(c);
    const amts = r.persons.map((p) => p.amount ?? 0n).sort();
    expect(amts.reduce((s, x) => s + x, 0n)).toBe(100n);
    expect(amts).toEqual([33n, 33n, 34n]);
  });
});

describe("robustness", () => {
  it("result is independent of the order in which people are entered", () => {
    const mk = (rev: boolean) => {
      const c = baseCase("male");
      c.family.wives = { state: "yes", list: [{ id: "w1", status: "married" }, { id: "w2", status: "married" }] };
      const kids = [kid("male", "alive", [], "أ"), kid("female", "alive", [], "ب"), kid("female", "alive", [], "ج")];
      c.family.children = rev ? [...kids].reverse() : kids;
      if (rev) c.family.wives.list.reverse();
      c.family.mother.state = "yes";
      return { r: calculateCase(c), kids };
    };
    const a = mk(false);
    const b = mk(true);
    const byName = (r: typeof a.r) => Object.fromEntries(r.persons.map((p) => [p.name ?? p.id, p.shareOfNet.toString()]));
    expect(byName(a.r)).toEqual(byName(b.r));
  });

  it("unknown relatives produce an incomplete status and scenarios, never silent absence", () => {
    const c = baseCase("male");
    c.family.children = [kid("female")];
    c.family.fullBrothers = { state: "unknown", count: 1, names: [] };
    const r = calculateCase(c);
    expect(r.status).toBe("incomplete");
    const s = unknownScenarios(c);
    expect(s.scenarios.length).toBe(2);
    const withB = s.scenarios.find((x) => x.assumptions.fullB)!;
    expect(withB.result.persons.find((p) => p.groupKey === "fullB")!.shareOfNet.toString()).toBe("1/2");
  });

  it("pregnancy: reserve the larger share, others get the lesser (art. 42)", () => {
    const c = baseCase("male");
    c.family.wives = { state: "yes", list: [{ id: "w1", status: "married" }] };
    c.family.father.state = "yes";
    c.flags.pregnancy = "yes";
    const pv = pregnancyScenarios(c);
    const father = pv.rows.find((r) => r.id === "father")!;
    expect(father.ifMale.toString()).toBe("1/6");
    expect(father.ifFemale.toString()).toBe("3/8");
    expect(father.immediate.toString()).toBe("1/6");
    expect(pv.reserved.toString()).toBe("17/24");
    expect(calculateCase(c).status).toBe("preliminary");
  });

  it("stop issues block a final result", () => {
    const c = baseCase("male");
    c.flags.missingPerson = "yes";
    c.family.children = [kid("male")];
    expect(calculateCase(c).status).toBe("stopped");
  });

  it("wife divorced irrevocably is excluded and shown with the reason", () => {
    const c = baseCase("male");
    c.family.wives = { state: "yes", list: [{ id: "w1", status: "bain" }, { id: "w2", status: "raji_idda" }] };
    c.family.children = [kid("male")];
    const r = calculateCase(c);
    expect(r.persons.find((p) => p.id === "w1")!.role).toBe("excluded");
    expect(r.persons.find((p) => p.id === "w2")!.shareOfNet.toString()).toBe("1/8");
  });

  it("remote agnates unresolved stop radd cases", () => {
    const c = baseCase("male");
    c.family.mother.state = "yes";
    c.family.remoteAgnates = "unknown";
    const r = calculateCase(c);
    expect(r.issues.some((i) => i.code === "REMOTE_AGNATES_UNKNOWN")).toBe(true);
  });
});

describe("text extraction (suggestions only)", () => {
  it("parses a simple sentence", () => {
    const p = parseCaseText("توفي رجل عن زوجة وابنين وبنت وأم");
    expect(p.deceasedGender).toBe("male");
    const m = Object.fromEntries(p.items.map((i) => [i.key, i.count]));
    expect(m).toEqual({ wives: 1, sons: 2, daughters: 1, mother: 1 });
  });
  it("requires sibling qualification", () => {
    const p = parseCaseText("توفيت امرأة عن زوج وأخت شقيقة وأخ لأم وأخ");
    const m = Object.fromEntries(p.items.map((i) => [i.key, i.count]));
    expect(m.husband).toBe(1);
    expect(m.fullS).toBe(1);
    expect(m.matB).toBe(1);
    expect(p.unrecognized.length).toBe(1);
  });
  it("numbers in words", () => {
    const p = parseCaseText("توفي عن ثلاثة أبناء وبنتين وأب");
    const m = Object.fromEntries(p.items.map((i) => [i.key, i.count]));
    expect(m).toEqual({ sons: 3, daughters: 2, father: 1 });
  });
});

describe("التخارج (art. 48)", () => {
  const heirs = [
    { id: "a", label: "أ", share: F(1, 2) },
    { id: "b", label: "ب", share: F(1, 3) },
    { id: "c", label: "ج", share: F(1, 6) },
  ];
  it("exit paid from the estate → shared pro rata", () => {
    const t = applyTakharuj({ heirs, exitingId: "c", mode: "with_all_from_estate", minorsInvolved: false });
    expect(t.rows.find((r) => r.id === "a")!.after.toString()).toBe("3/5");
    expect(t.rows.find((r) => r.id === "b")!.after.toString()).toBe("2/5");
  });
  it("exit paid from heirs' own money, no agreed split → equal", () => {
    const t = applyTakharuj({ heirs, exitingId: "c", mode: "with_all_own_money", minorsInvolved: true });
    expect(t.rows.find((r) => r.id === "a")!.after.toString()).toBe("7/12");
    expect(t.notes.some((n) => n.includes("قاصر"))).toBe(true);
  });
  it("sums are preserved", () => {
    const t = applyTakharuj({ heirs, exitingId: "a", mode: "with_one", withId: "b", minorsInvolved: false });
    expect(Fraction.sum(t.rows.map((r) => r.after)).toString()).toBe("1");
  });
});

import { evaluateCase } from "../src/engine";
describe("material vs immaterial unknowns", () => {
  it("unknown siblings with a son are immaterial", () => {
    const c = baseCase("male");
    c.family.children = [kid("male")];
    c.family.fullBrothers = { state: "unknown", count: 1, names: [] };
    c.family.matSisters = { state: "unknown", count: 1, names: [] };
    const e = evaluateCase(c);
    expect(e.material.length).toBe(0);
    expect(e.result.status).toBe("final");
  });
  it("two unknown sibling groups that jointly reduce the mother are material", () => {
    const c = baseCase("male");
    c.family.father.state = "yes";
    c.family.mother.state = "yes";
    c.family.fullBrothers = { state: "unknown", count: 1, names: [] };
    c.family.matSisters = { state: "unknown", count: 1, names: [] };
    const e = evaluateCase(c);
    expect(e.material.length).toBe(2);
    expect(e.result.status).toBe("incomplete");
    expect(e.scenarios.length).toBe(4);
  });
});
