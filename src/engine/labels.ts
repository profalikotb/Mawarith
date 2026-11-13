import type { GroupKey } from "./types";

/** Arabic labels for heir groups (singular, dual, plural). */
const L: Record<string, [string, string, string]> = {
  husband: ["الزوج", "الزوج", "الزوج"],
  wives: ["الزوجة", "الزوجتان", "الزوجات"],
  father: ["الأب", "الأب", "الأب"],
  mother: ["الأم", "الأم", "الأم"],
  gf: ["الجد لأب (أبو الأب)", "الجد", "الجد"],
  gm_mm: ["الجدة أم الأم", "", ""],
  gm_fm: ["الجدة أم الأب", "", ""],
  gm_mmm: ["الجدة أم أم الأم", "", ""],
  gm_fmm: ["الجدة أم أم الأب", "", ""],
  gm_ffm: ["الجدة أم أبي الأب", "", ""],
  fullB: ["الأخ الشقيق", "الأخوان الشقيقان", "الإخوة الأشقاء"],
  fullS: ["الأخت الشقيقة", "الأختان الشقيقتان", "الأخوات الشقيقات"],
  patB: ["الأخ لأب", "الأخوان لأب", "الإخوة لأب"],
  patS: ["الأخت لأب", "الأختان لأب", "الأخوات لأب"],
  matB: ["الأخ لأم", "الأخوان لأم", "الإخوة لأم"],
  matS: ["الأخت لأم", "الأختان لأم", "الأخوات لأم"],
  fullN: ["ابن الأخ الشقيق", "ابنا الأخ الشقيق", "أبناء الإخوة الأشقاء"],
  patN: ["ابن الأخ لأب", "ابنا الأخ لأب", "أبناء الإخوة لأب"],
  fullNS: ["ابن ابن الأخ الشقيق", "ابنا ابن الأخ الشقيق", "أبناء أبناء الإخوة الأشقاء"],
  patNS: ["ابن ابن الأخ لأب", "ابنا ابن الأخ لأب", "أبناء أبناء الإخوة لأب"],
  fullU: ["العم الشقيق", "العمان الشقيقان", "الأعمام الأشقاء"],
  patU: ["العم لأب", "العمان لأب", "الأعمام لأب"],
  fullC: ["ابن العم الشقيق", "ابنا العم الشقيق", "أبناء الأعمام الأشقاء"],
  patC: ["ابن العم لأب", "ابنا العم لأب", "أبناء الأعمام لأب"],
  fullCS: ["ابن ابن العم الشقيق", "ابنا ابن العم الشقيق", "أبناء أبناء الأعمام الأشقاء"],
  patCS: ["ابن ابن العم لأب", "ابنا ابن العم لأب", "أبناء أبناء الأعمام لأب"],
  treasury: ["الخزانة العامة", "", ""],
  distantKin: ["ذوو الأرحام", "", ""],
};

const descNames = (level: number, male: boolean): [string, string, string] => {
  if (level === 1) return male ? ["الابن", "الابنان", "الأبناء"] : ["البنت", "البنتان", "البنات"];
  const chain = Array(level - 1).fill("ابن").join(" ");
  // level 2: ابن الابن ; level 3: ابن ابن الابن
  const tail = level === 2 ? "الابن" : `ابن ${Array(level - 2).fill("ابن").join(" ")}`.replace(/ابن$/, "الابن");
  if (male) {
    return [`ابن ${tail}`, `ابنا ${tail}`, `أبناء ${tail}`];
  }
  void chain;
  return [`بنت ${tail}`, `بنتا ${tail}`, `بنات ${tail}`];
};

export function groupLabel(key: GroupKey | string, count = 1): string {
  const m = /^desc(\d+)_(m|f)$/.exec(key);
  const forms = m ? descNames(Number(m[1]), m[2] === "m") : L[key];
  if (!forms) return key;
  if (count <= 1 || !forms[1]) return forms[0];
  if (count === 2) return forms[1];
  return forms[2];
}

export function singularLabel(key: GroupKey | string): string {
  return groupLabel(key, 1);
}

/** Canonical display/allocation order for groups — deterministic regardless of input order. */
export const GROUP_ORDER: string[] = [
  "husband",
  "wives",
  "father",
  "mother",
  "gf",
  "gm_mm",
  "gm_fm",
  "gm_mmm",
  "gm_fmm",
  "gm_ffm",
  ...Array.from({ length: 6 }, (_, i) => [`desc${i + 1}_m`, `desc${i + 1}_f`]).flat(),
  "fullB",
  "fullS",
  "patB",
  "patS",
  "matB",
  "matS",
  "fullN",
  "patN",
  "fullNS",
  "patNS",
  "fullU",
  "patU",
  "fullC",
  "patC",
  "fullCS",
  "patCS",
  "distantKin",
  "treasury",
];

export function groupOrder(key: string): number {
  const i = GROUP_ORDER.indexOf(key);
  return i < 0 ? 999 : i;
}
