/**
 * Converts the user-facing family description into determined heir counts,
 * a list of person "seeds" (for per-person output), and the list of
 * unresolved unknowns. Unknowns are never treated as absent: they must be
 * resolved by an explicit assumption (scenario) or by the user.
 */
import type { Descendant, Family, Group, HeirCounts, Issue, CaseInput, Tri, GroupKey } from "./types";

export interface PersonSeed {
  id: string;
  name?: string;
  groupKey: GroupKey;
  /** wife/husband status notes, died-after etc. */
  note?: string;
  diedAfter?: boolean;
}

export interface ExcludedSeed {
  id: string;
  name?: string;
  relation: string;
  reason: string;
  ruleId: string;
}

export interface UnknownItem {
  id: string;
  label: string;
  question: string;
}

export interface Derived {
  counts: HeirCounts;
  persons: PersonSeed[];
  excluded: ExcludedSeed[];
  unknowns: UnknownItem[];
  issues: Issue[];
  /** predeceased / simultaneous children of the decedent (wajiba roots) */
  wajibaRoots: Descendant[];
  /** map descendant id -> male-line level (for heirs) */
  descLevel: Map<string, number>;
}

export type Assumptions = Record<string, boolean>;

const MAX_LEVELS = 6;

function triResolve(state: Tri, id: string, label: string, question: string, a: Assumptions, unknowns: UnknownItem[]): boolean {
  if (state === "yes") return true;
  if (state === "no") return false;
  if (id in a) return a[id];
  unknowns.push({ id, label, question });
  return false;
}

export function deriveCounts(input: CaseInput, a: Assumptions = {}): Derived {
  const f: Family = input.family;
  const male = input.meta.deceasedGender === "male";
  const unknowns: UnknownItem[] = [];
  const issues: Issue[] = [];
  const persons: PersonSeed[] = [];
  const excluded: ExcludedSeed[] = [];
  const descLevel = new Map<string, number>();

  const counts: HeirCounts = {
    husband: 0,
    wives: 0,
    father: 0,
    mother: 0,
    gf: 0,
    gm: { mm: 0, fm: 0, mmm: 0, fmm: 0, ffm: 0 },
    desc: Array.from({ length: MAX_LEVELS }, () => ({ sons: 0, daughters: 0 })),
    fullB: 0,
    fullS: 0,
    patB: 0,
    patS: 0,
    matB: 0,
    matS: 0,
    fullN: 0,
    patN: 0,
    fullNS: 0,
    patNS: 0,
    fullU: 0,
    patU: 0,
    fullC: 0,
    patC: 0,
    fullCS: 0,
    patCS: 0,
    distantKin: false,
  };

  /* spouses */
  if (!male) {
    if (triResolve(f.husband.state, "husband", "الزوج", "هل كان للمتوفاة زوج على قيد الحياة وقت وفاتها؟", a, unknowns)) {
      if (f.husband.status === "bain") {
        excluded.push({ id: "husband", name: f.husband.name, relation: "المطلِّق", reason: "طلاق بائن قبل الوفاة — لا يرث", ruleId: "EG77-11" });
      } else {
        counts.husband = 1;
        persons.push({
          id: "husband",
          name: f.husband.name,
          groupKey: "husband",
          note: f.husband.status === "raji_idda" ? "مطلِّق رجعيًا وماتت في العدة — يرث" : undefined,
        });
      }
    }
  } else {
    const has = triResolve(f.wives.state, "wives", "الزوجة/الزوجات", "هل كان للمتوفى زوجة أو زوجات على قيد الحياة وقت وفاته؟", a, unknowns);
    if (has) {
      if (f.wives.list.length === 0) {
        issues.push({ code: "WIVES_EMPTY", severity: "stop", message: "حُدد وجود زوجة دون إضافة بياناتها.", needed: "أضف الزوجة أو الزوجات." });
      }
      if (f.wives.list.length > 4) {
        issues.push({ code: "WIVES_GT4", severity: "stop", message: "عدد الزوجات المدخل يزيد على أربع.", needed: "راجع بيانات الزوجات." });
      }
      for (const w of f.wives.list) {
        if (w.status === "bain") {
          excluded.push({ id: w.id, name: w.name, relation: "مطلقة", reason: "مطلقة بائنًا — لا ترث", ruleId: "EG77-11" });
          continue;
        }
        if (w.status === "bain_marad") {
          issues.push({
            code: "WIFE_BAIN_MARAD",
            severity: "review",
            message:
              "مطلقة بائنًا في مرض الموت: تعتبر في حكم الزوجة إذا لم ترض بالطلاق ومات المطلق في ذلك المرض وهي في عدته. يحتاج ثبوت ذلك إلى مراجعة.",
          });
        }
        counts.wives++;
        persons.push({
          id: w.id,
          name: w.name,
          groupKey: "wives",
          note: w.status === "raji_idda" ? "مطلقة رجعيًا في العدة — ترث" : w.status === "bain_marad" ? "مطلقة في مرض الموت — بشرط ثبوت شروط المادة 11" : undefined,
        });
      }
    }
  }

  /* parents & grandparents */
  const single = (state: Tri, id: GroupKey, label: string, q: string, name?: string) => {
    if (triResolve(state, id, label, q, a, unknowns)) {
      persons.push({ id, name, groupKey: id });
      return 1;
    }
    return 0;
  };
  counts.father = single(f.father.state, "father", "الأب", "هل كان الأب على قيد الحياة وقت الوفاة؟", f.father.name);
  counts.mother = single(f.mother.state, "mother", "الأم", "هل كانت الأم على قيد الحياة وقت الوفاة؟", f.mother.name);
  counts.gf = single(f.paternalGrandfather.state, "gf", "الجد لأب", "هل كان الجد أبو الأب على قيد الحياة وقت الوفاة؟", f.paternalGrandfather.name);
  const gmQ: Record<string, string> = {
    mm: "أم الأم",
    fm: "أم الأب",
    mmm: "أم أم الأم",
    fmm: "أم أم الأب",
    ffm: "أم أبي الأب",
  };
  for (const k of ["mm", "fm", "mmm", "fmm", "ffm"] as const) {
    const key = `gm_${k}` as GroupKey;
    counts.gm[k] = single(f.gm[k], key, `الجدة ${gmQ[k]}`, `هل كانت ${gmQ[k]} على قيد الحياة وقت الوفاة؟`);
  }

  /* descendants */
  const wajibaRoots: Descendant[] = [];
  const statusOf = (d: Descendant, label: string): "alive" | "dead" | "dead_wajiba" => {
    let s = d.status;
    if (s === "unknown") {
      const id = `desc:${d.id}`;
      if (id in a) s = a[id] ? "alive" : "predeceased";
      else {
        unknowns.push({ id, label, question: `هل كان ${label}${d.name ? ` (${d.name})` : ""} حيًّا وقت وفاة المورث؟` });
        s = "predeceased";
      }
    }
    if (s === "alive" || s === "died_after") return "alive";
    if (s === "simultaneous") return "dead_wajiba";
    return "dead";
  };

  const walk = (d: Descendant, level: number, maleLine: boolean, path: ("male" | "female")[]) => {
    const label = relationText(path);
    if (level > MAX_LEVELS) {
      issues.push({ code: "DESC_DEEP", severity: "stop", message: "عمق الفروع المدخلة يتجاوز ما يدعمه الإصدار.", needed: "مراجعة متخصص." });
      return;
    }
    const st = statusOf(d, label);
    if (st === "alive") {
      if (maleLine) {
        const lv = counts.desc[level - 1];
        if (d.gender === "male") lv.sons++;
        else lv.daughters++;
        const key = `desc${level}_${d.gender === "male" ? "m" : "f"}` as GroupKey;
        descLevel.set(d.id, level);
        persons.push({
          id: d.id,
          name: d.name,
          groupKey: key,
          diedAfter: d.status === "died_after",
          note: d.status === "died_after" ? "توفي بعد المورث — ينتقل نصيبه إلى ورثته (مناسخة)" : undefined,
        });
      } else {
        counts.distantKin = true; // child of a daughter (or of a son's daughter)
      }
    }
    if (st === "dead_wajiba" && level === 1) {
      issues.push({
        code: "SIMULTANEOUS_CHILD",
        severity: "info",
        message: `${d.name || label}: توفي مع المورث أو جُهل الترتيب، فلا يرث منه (المادة 3)، ويُبحث استحقاق فرعه للوصية الواجبة.`,
      });
    }
    if (st !== "alive" && level === 1) wajibaRoots.push(d);
    const childMaleLine = maleLine && d.gender === "male";
    for (const c of d.children) {
      walk(c, level + 1, childMaleLine, [...path, c.gender]);
    }
  };
  for (const c of f.children) walk(c, 1, true, [c.gender]);

  /* siblings and agnates */
  const grp = (g: Group, key: GroupKey, label: string): number => {
    const has = triResolve(g.state, key, label, `هل يوجد ${label} على قيد الحياة وقت الوفاة؟`, a, unknowns);
    if (!has) return 0;
    const n = Math.max(1, Math.floor(g.count || 1));
    for (let i = 0; i < n; i++) persons.push({ id: `${key}#${i + 1}`, name: g.names?.[i], groupKey: key });
    return n;
  };
  counts.fullB = grp(f.fullBrothers, "fullB", "أخ شقيق");
  counts.fullS = grp(f.fullSisters, "fullS", "أخت شقيقة");
  counts.patB = grp(f.patBrothers, "patB", "أخ لأب");
  counts.patS = grp(f.patSisters, "patS", "أخت لأب");
  counts.matB = grp(f.matBrothers, "matB", "أخ لأم");
  counts.matS = grp(f.matSisters, "matS", "أخت لأم");
  counts.fullN = grp(f.fullNephews, "fullN", "ابن أخ شقيق");
  counts.patN = grp(f.patNephews, "patN", "ابن أخ لأب");
  counts.fullNS = grp(f.fullNephewSons, "fullNS", "ابن ابن أخ شقيق");
  counts.patNS = grp(f.patNephewSons, "patNS", "ابن ابن أخ لأب");
  counts.fullU = grp(f.fullUncles, "fullU", "عم شقيق");
  counts.patU = grp(f.patUncles, "patU", "عم لأب");
  counts.fullC = grp(f.fullCousins, "fullC", "ابن عم شقيق");
  counts.patC = grp(f.patCousins, "patC", "ابن عم لأب");
  counts.fullCS = grp(f.fullCousinSons, "fullCS", "ابن ابن عم شقيق");
  counts.patCS = grp(f.patCousinSons, "patCS", "ابن ابن عم لأب");

  if (triResolve(f.distantKin, "distantKin", "ذوو الأرحام", "هل يوجد من ذوي الأرحام (كالخال أو العمة أو أولاد الأخوات أو أولاد البنات) أحد على قيد الحياة؟", a, unknowns))
    counts.distantKin = true;

  // remote agnates are resolved later (they only matter when no closer agnate exists)
  if (f.remoteAgnates === "unknown" && !("remoteAgnates" in a)) {
    // only relevant when nobody else takes the residue — checked in the pipeline
  }

  return { counts, persons, excluded, unknowns, issues, wajibaRoots, descLevel };
}

export function emptyGroup(): Group {
  return { state: "no", count: 1, names: [] };
}

/** Arabic kinship text for a descendant path, e.g. [male, female] → "بنت الابن". */
export function relationText(path: ("male" | "female")[]): string {
  const words = path.map((g) => (g === "male" ? "ابن" : "بنت"));
  const last = words.pop()!;
  if (!words.length) return last === "ابن" ? "الابن" : "البنت";
  const chain: string[] = words.reverse();
  chain[chain.length - 1] = "ال" + chain[chain.length - 1];
  return [last, ...chain].join(" ");
}
