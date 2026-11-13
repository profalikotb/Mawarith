import type { CaseInput, Descendant, Group } from "@/engine";

export type Update = (fn: (c: CaseInput) => void) => void;

export type GroupField =
  | "fullBrothers"
  | "fullSisters"
  | "patBrothers"
  | "patSisters"
  | "matBrothers"
  | "matSisters"
  | "fullNephews"
  | "patNephews"
  | "fullNephewSons"
  | "patNephewSons"
  | "fullUncles"
  | "patUncles"
  | "fullCousins"
  | "patCousins"
  | "fullCousinSons"
  | "patCousinSons";

export const GROUP_KEY_TO_FIELD: Record<string, GroupField> = {
  fullB: "fullBrothers",
  fullS: "fullSisters",
  patB: "patBrothers",
  patS: "patSisters",
  matB: "matBrothers",
  matS: "matSisters",
  fullN: "fullNephews",
  patN: "patNephews",
  fullNS: "fullNephewSons",
  patNS: "patNephewSons",
  fullU: "fullUncles",
  patU: "patUncles",
  fullC: "fullCousins",
  patC: "patCousins",
  fullCS: "fullCousinSons",
  patCS: "patCousinSons",
};

export function findDesc(list: Descendant[], id: string): Descendant | undefined {
  for (const d of list) {
    if (d.id === id) return d;
    const x = findDesc(d.children, id);
    if (x) return x;
  }
  return undefined;
}

/** Apply an answer to an unknown item (from the completion assistant). */
export function applyUnknown(c: CaseInput, id: string, yes: boolean) {
  const st = yes ? "yes" : "no";
  if (id.startsWith("desc:")) {
    const d = findDesc(c.family.children, id.slice(5));
    if (d) d.status = yes ? "alive" : "predeceased";
    return;
  }
  if (id.startsWith("gm_")) {
    const k = id.slice(3) as keyof CaseInput["family"]["gm"];
    c.family.gm[k] = st;
    return;
  }
  switch (id) {
    case "husband":
      c.family.husband.state = st;
      return;
    case "wives":
      c.family.wives.state = st;
      if (yes && !c.family.wives.list.length) c.family.wives.list.push({ id: `w_${Date.now()}`, status: "married" });
      return;
    case "father":
      c.family.father.state = st;
      return;
    case "mother":
      c.family.mother.state = st;
      return;
    case "gf":
      c.family.paternalGrandfather.state = st;
      return;
    case "distantKin":
      c.family.distantKin = st;
      return;
  }
  const f = GROUP_KEY_TO_FIELD[id];
  if (f) (c.family[f] as Group).state = st;
}

export const ASSET_KINDS: { v: string; t: string }[] = [
  { v: "cash", t: "نقود" },
  { v: "bank", t: "حسابات وودائع بنكية" },
  { v: "realestate", t: "عقار (شقة/منزل/محل)" },
  { v: "land", t: "أرض زراعية أو فضاء" },
  { v: "gold", t: "ذهب وحُلي" },
  { v: "vehicle", t: "سيارة/مركبة" },
  { v: "securities", t: "أسهم وصكوك وأوراق مالية" },
  { v: "other", t: "أصول أخرى" },
];
