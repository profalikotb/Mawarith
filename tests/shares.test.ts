/**
 * Reference cases for the share engine. Each case lists its basis.
 * "Classical" = well-known textbook case of فقه المواريث whose result is not
 * disputed under the Egyptian statute; statute articles are cited.
 */
import { describe, it, expect } from "vitest";
import { counts, shares } from "./helpers";

describe("spouses & children", () => {
  it("husband + son → 1/4, 3/4 (art. 11, 17)", () => {
    const { m } = shares(counts({ husband: 1, desc: [[1, 0]] }));
    expect(m.husband).toBe("1/4");
    expect(m.desc1_m).toBe("3/4");
  });
  it("wife + son + daughter → 1/8, 7/12, 7/24 (art. 11, 19)", () => {
    const { m, r } = shares(counts({ wives: 1, desc: [[1, 1]] }));
    expect(m.wives).toBe("1/8");
    expect(m.desc1_m).toBe("7/12");
    expect(m.desc1_f).toBe("7/24");
    expect(r.base).toBe(8n);
    expect(r.tashih).toBe(24n);
  });
  it("three wives + two sons → each wife 1/24, each son 7/16", () => {
    const { m, r } = shares(counts({ wives: 3, desc: [[2, 0]] }));
    expect(m.wives).toBe("1/24");
    expect(m.desc1_m).toBe("7/16");
    expect(r.tashih).toBe(48n);
  });
  it("father + mother + son → 1/6, 1/6, 2/3", () => {
    const { m } = shares(counts({ father: 1, mother: 1, desc: [[1, 0]] }));
    expect([m.father, m.mother, m.desc1_m]).toEqual(["1/6", "1/6", "2/3"]);
  });
  it("father with daughter takes 1/6 + residue (art. 21)", () => {
    const { m, r } = shares(counts({ father: 1, desc: [[0, 1]] }));
    expect(m.desc1_f).toBe("1/2");
    expect(m.father).toBe("1/2");
    expect(r.groups.find((g) => g.key === "father")!.basis).toBe("fard_asaba");
  });
});

describe("العمريتان (art. 14)", () => {
  it("husband + father + mother → 1/2, 1/3, 1/6", () => {
    const { m, r } = shares(counts({ husband: 1, father: 1, mother: 1 }));
    expect([m.husband, m.father, m.mother]).toEqual(["1/2", "1/3", "1/6"]);
    expect(r.special).toContain("العمرية");
  });
  it("wife + father + mother → 1/4, 1/2, 1/4", () => {
    const { m } = shares(counts({ wives: 1, father: 1, mother: 1 }));
    expect([m.wives, m.father, m.mother]).toEqual(["1/4", "1/2", "1/4"]);
  });
  it("does NOT apply with the grandfather instead of the father", () => {
    const { m } = shares(counts({ husband: 1, gf: 1, mother: 1 }));
    expect(m.mother).toBe("1/3");
    expect(m.gf).toBe("1/6");
  });
});

describe("العول (art. 15)", () => {
  it("المنبرية: wife, 2 daughters, father, mother → 24 عالت إلى 27", () => {
    const { m, r } = shares(counts({ wives: 1, father: 1, mother: 1, desc: [[0, 2]] }));
    expect(r.base).toBe(24n);
    expect(r.awlTo).toBe(27n);
    expect(m.wives).toBe("1/9");
    expect(m.desc1_f).toBe("8/27");
    expect(m.father).toBe("4/27");
    expect(m.mother).toBe("4/27");
  });
  it("husband + 2 full sisters → 6 عالت إلى 7", () => {
    const { m, r } = shares(counts({ husband: 1, fullS: 2 }));
    expect(r.awlTo).toBe(7n);
    expect(m.husband).toBe("3/7");
    expect(m.fullS).toBe("2/7");
  });
});

describe("المشتركة (art. 10/2)", () => {
  it("husband, mother, 2 maternal brothers, full brother → the third shared equally", () => {
    const { m, r } = shares(counts({ husband: 1, mother: 1, matB: 2, fullB: 1 }));
    expect(m.husband).toBe("1/2");
    expect(m.mother).toBe("1/6");
    expect(m.matB).toBe("1/9");
    expect(m.fullB).toBe("1/9");
    expect(r.special).toContain("المشتركة");
  });
  it("not applied to paternal brothers", () => {
    const { m } = shares(counts({ husband: 1, mother: 1, matB: 2, patB: 1 }));
    expect(m.patB).toBe("0");
    expect(m.matB).toBe("1/6");
  });
});

describe("الرد (art. 30)", () => {
  it("mother + daughter → 1/4, 3/4", () => {
    const { m, r } = shares(counts({ mother: 1, desc: [[0, 1]] }));
    expect(m.desc1_f).toBe("3/4");
    expect(m.mother).toBe("1/4");
    expect(r.radd).toBe(true);
  });
  it("wife + daughter + mother → spouse keeps her fard; rest 3:1", () => {
    const { m } = shares(counts({ wives: 1, mother: 1, desc: [[0, 1]] }));
    expect(m.wives).toBe("1/8");
    expect(m.desc1_f).toBe("21/32");
    expect(m.mother).toBe("7/32");
  });
  it("husband alone with no distant kin → all to husband by radd", () => {
    const { m, r } = shares(counts({ husband: 1 }));
    expect(m.husband).toBe("1");
    expect(r.radd).toBe(true);
  });
  it("husband + distant kin → stop (dhawu al-arham before radd on spouse)", () => {
    const { r } = shares(counts({ husband: 1, distantKin: true }));
    expect(r.issues.some((i) => i.code === "DISTANT_KIN" && i.severity === "stop")).toBe(true);
    expect(r.residueTo).toBe("distantKin");
  });
  it("nobody → treasury", () => {
    const { r } = shares(counts({}));
    expect(r.residueTo).toBe("treasury");
  });
});

describe("بنات الابن (arts. 12, 19, 27)", () => {
  it("daughter + son's daughter + full brother → 1/2, 1/6, 1/3", () => {
    const { m } = shares(counts({ fullB: 1, desc: [[0, 1], [0, 1]] }));
    expect([m.desc1_f, m.desc2_f, m.fullB]).toEqual(["1/2", "1/6", "1/3"]);
  });
  it("two daughters block son's daughter without a male cousin", () => {
    const { m, r } = shares(counts({ fullU: 1, desc: [[0, 2], [0, 1]] }));
    expect(m.desc2_f).toBe("0");
    expect(r.groups.find((g) => g.key === "desc2_f")!.basis).toBe("blocked");
  });
  it("القريب المبارك: 2 daughters + son's daughter + son's son's son", () => {
    const { m } = shares(counts({ desc: [[0, 2], [0, 1], [1, 0]] }));
    expect(m.desc1_f).toBe("1/3");
    expect(m.desc2_f).toBe("1/9");
    expect(m.desc3_m).toBe("2/9");
  });
  it("son blocks all son's children", () => {
    const { m } = shares(counts({ desc: [[1, 0], [2, 2]] }));
    expect(m.desc1_m).toBe("1");
    expect(m.desc2_m).toBe("0");
    expect(m.desc2_f).toBe("0");
  });
});

describe("الإخوة والأخوات (arts. 13, 19, 20, 26, 28, 29)", () => {
  it("daughter + full sister → sister takes residue (ma'a al-ghayr)", () => {
    const { m, r } = shares(counts({ desc: [[0, 1]], fullS: 1, patB: 1 }));
    expect(m.fullS).toBe("1/2");
    expect(m.patB).toBe("0");
    expect(r.groups.find((g) => g.key === "fullS")!.basis).toBe("asaba_maa_ghayr");
  });
  it("full sister + paternal sister + uncle → 1/2, 1/6, 1/3", () => {
    const { m } = shares(counts({ fullS: 1, patS: 1, fullU: 1 }));
    expect([m.fullS, m.patS, m.fullU]).toEqual(["1/2", "1/6", "1/3"]);
  });
  it("2 full sisters + paternal sister + paternal brother (الأخ المبارك)", () => {
    const { m } = shares(counts({ fullS: 2, patS: 1, patB: 1 }));
    expect(m.fullS).toBe("1/3");
    expect(m.patB).toBe("2/9");
    expect(m.patS).toBe("1/9");
  });
  it("2 full sisters block paternal sister without a paternal brother", () => {
    const { m } = shares(counts({ fullS: 2, patS: 1, fullU: 1 }));
    expect(m.patS).toBe("0");
    expect(m.fullU).toBe("1/3");
  });
  it("maternal siblings: brother & sister share the third equally", () => {
    const { m } = shares(counts({ mother: 1, matB: 1, matS: 1, fullB: 1 }));
    expect(m.mother).toBe("1/6");
    expect(m.matB).toBe("1/6");
    expect(m.matS).toBe("1/6");
    expect(m.fullB).toBe("1/2");
  });
  it("a daughter blocks maternal siblings (art. 26)", () => {
    const { m } = shares(counts({ matB: 2, desc: [[0, 1]], fullU: 1 }));
    expect(m.matB).toBe("0");
  });
  it("blocked brothers still reduce the mother to 1/6", () => {
    const { m } = shares(counts({ father: 1, mother: 1, fullB: 2 }));
    expect(m.mother).toBe("1/6");
    expect(m.father).toBe("5/6");
    expect(m.fullB).toBe("0");
  });
  it("full nephew blocks paternal nephew and uncles", () => {
    const { m } = shares(counts({ wives: 1, fullN: 2, patN: 1, fullU: 1 }));
    expect(m.fullN).toBe("3/8");
    expect(m.patN).toBe("0");
    expect(m.fullU).toBe("0");
  });
});

describe("الجد مع الإخوة (art. 22)", () => {
  it("GF + full brother → muqasama 1/2 each", () => {
    const { m, r } = shares(counts({ gf: 1, fullB: 1 }));
    expect(m.gf).toBe("1/2");
    expect(m.fullB).toBe("1/2");
    expect(r.issues.some((i) => i.code === "GF_SIBLINGS")).toBe(true);
  });
  it("GF + mother + 5 full brothers → muqasama < 1/6 so GF takes 1/6", () => {
    const { m } = shares(counts({ gf: 1, mother: 1, fullB: 5 }));
    expect(m.mother).toBe("1/6");
    expect(m.gf).toBe("1/6");
    expect(m.fullB).toBe("2/15");
  });
  it("GF + full sister (no descendants) → sister 1/2 fard, GF residue", () => {
    const { m } = shares(counts({ gf: 1, fullS: 1 }));
    expect(m.fullS).toBe("1/2");
    expect(m.gf).toBe("1/2");
  });
  it("GF + daughter + full sister → GF shares residue as a brother", () => {
    const { m } = shares(counts({ gf: 1, fullS: 1, desc: [[0, 1]] }));
    expect(m.desc1_f).toBe("1/2");
    expect(m.gf).toBe("1/3");
    expect(m.fullS).toBe("1/6");
  });
  it("husband, mother, GF, full sister (الأكدرية shape) → GF floor 1/6 with awl to 9", () => {
    const { m, r } = shares(counts({ husband: 1, mother: 1, gf: 1, fullS: 1 }));
    expect(r.awlTo).toBe(9n);
    expect(m.husband).toBe("1/3");
    expect(m.mother).toBe("2/9");
    expect(m.fullS).toBe("1/3");
    expect(m.gf).toBe("1/9");
  });
  it("GF does not block full siblings but blocks maternal siblings and nephews", () => {
    const { m } = shares(counts({ gf: 1, fullB: 1, matB: 1, fullN: 1 }));
    expect(m.matB).toBe("0");
    expect(m.fullN).toBe("0");
  });
  it("GF + full sister + paternal brother → unsupported (stop)", () => {
    const { r } = shares(counts({ gf: 1, fullS: 1, patB: 1 }));
    expect(r.issues.some((i) => i.code === "GF_MIXED" && i.severity === "stop")).toBe(true);
  });
});

describe("الجدات (arts. 14, 25)", () => {
  it("father blocks paternal grandmother; maternal one takes 1/6", () => {
    const { m } = shares(counts({ father: 1, gm: { mm: 1, fm: 1 }, desc: [[1, 0]] }));
    expect(m.gm_mm).toBe("1/6");
    expect(m.gm_fm).toBe("0");
  });
  it("two grandmothers of the same degree share 1/6", () => {
    const { m } = shares(counts({ gm: { mm: 1, fm: 1 }, desc: [[1, 0]] }));
    expect(m.gm_mm).toBe("1/12");
    expect(m.gm_fm).toBe("1/12");
  });
  it("the nearer grandmother blocks the farther", () => {
    const { m } = shares(counts({ gm: { fm: 1, mmm: 1 }, desc: [[1, 0]] }));
    expect(m.gm_fm).toBe("1/6");
    expect(m.gm_mmm).toBe("0");
  });
  it("mother blocks all grandmothers", () => {
    const { m } = shares(counts({ mother: 1, gm: { mm: 1, fm: 1 }, desc: [[1, 0]] }));
    expect(m.gm_mm).toBe("0");
  });
});

describe("invariants", () => {
  const samples = [
    counts({ husband: 1, mother: 1, matB: 2, fullB: 2, fullS: 1 }),
    counts({ wives: 4, father: 1, mother: 1, desc: [[3, 5], [2, 2]] }),
    counts({ gf: 1, gm: { mm: 1 }, fullB: 2, fullS: 3, wives: 2 }),
    counts({ husband: 1, fullS: 1, patS: 2, matS: 2, mother: 1 }),
  ];
  it("totals always sum to exactly 1 and no share is negative", () => {
    for (const h of samples) {
      const { r } = shares(h);
      let s = 0n,
        d = 1n;
      void s;
      void d;
      const total = r.groups.reduce((a, g) => a.add(g.total), r.groups[0].total.sub(r.groups[0].total));
      expect(total.toString()).toBe("1");
      for (const g of r.groups) expect(g.total.isNeg()).toBe(false);
    }
  });
});
