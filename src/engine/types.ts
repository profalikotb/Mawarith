import type { Fraction } from "./fraction";

export type Tri = "yes" | "no" | "unknown";
export type Gender = "male" | "female";

/** Status of a relative relative to the moment of the decedent's death. */
export type LifeStatus =
  | "alive" // حي وقت وفاة المورث
  | "predeceased" // توفي قبل المورث
  | "simultaneous" // توفي معه أو لم يُعلم أيهما مات أولًا
  | "died_after" // توفي بعد المورث (يرث، وينتقل نصيبه لورثته)
  | "unknown";

export interface Descendant {
  id: string;
  name?: string;
  gender: Gender;
  status: LifeStatus;
  deathDate?: string; // ISO yyyy-mm-dd, optional
  /** Amount (piasters) given by the decedent without consideration — relevant to obligatory bequest. */
  giftPiasters?: string;
  children: Descendant[];
}

/** A countable category of relatives (siblings, nephews, uncles...). */
export interface Group {
  state: Tri;
  count: number;
  names?: string[];
}

export type WifeStatus = "married" | "raji_idda" | "bain_marad" | "bain";
export type HusbandStatus = "married" | "raji_idda" | "bain";

export interface Wife {
  id: string;
  name?: string;
  status: WifeStatus;
}

export interface Family {
  husband: { state: Tri; name?: string; status: HusbandStatus };
  wives: { state: Tri; list: Wife[] };
  father: { state: Tri; name?: string };
  mother: { state: Tri; name?: string };
  /** أب الأب */
  paternalGrandfather: { state: Tri; name?: string };
  /** grandmothers (الجدات الصحيحات) */
  gm: {
    mm: Tri; // أم الأم
    fm: Tri; // أم الأب
    mmm: Tri; // أم أم الأم
    fmm: Tri; // أم أم الأب
    ffm: Tri; // أم أب الأب
  };
  children: Descendant[];
  fullBrothers: Group;
  fullSisters: Group;
  patBrothers: Group;
  patSisters: Group;
  matBrothers: Group;
  matSisters: Group;
  fullNephews: Group; // ابن الأخ الشقيق
  patNephews: Group; // ابن الأخ لأب
  fullNephewSons: Group; // ابن ابن الأخ الشقيق
  patNephewSons: Group; // ابن ابن الأخ لأب
  fullUncles: Group; // العم الشقيق
  patUncles: Group; // العم لأب
  fullCousins: Group; // ابن العم الشقيق
  patCousins: Group; // ابن العم لأب
  fullCousinSons: Group; // ابن ابن العم الشقيق
  patCousinSons: Group; // ابن ابن العم لأب
  /** أعمام الأب أو الجد وأبناؤهم ونحوهم من العصبات الأبعد */
  remoteAgnates: Tri;
  /** ذوو الأرحام (أولاد البنات، الأخوال، العمات، أولاد الأخوات...) */
  distantKin: Tri;
  /** التأكيد النهائي: هل يوجد قريب آخر لم يضف وقد يؤثر؟ */
  otherRelative: Tri;
}

export interface Flags {
  pregnancy: Tri;
  pregnancyRelation: "decedent_child" | "other";
  missingPerson: Tri;
  heirDiedAfter: Tri; // مناسخة
  simultaneousDeath: Tri;
  nasabDispute: Tri;
  marriageDispute: Tri;
  divorceIssue: Tri;
  impediment: Tri; // قتل / اختلاف دين
  minors: Tri;
  disputedWill: Tri;
  foreignAssets: Tri;
  generalDispute: Tri;
}

export type AssetKind = "cash" | "bank" | "realestate" | "land" | "gold" | "vehicle" | "securities" | "other";

export interface Asset {
  id: string;
  kind: AssetKind;
  label: string;
  /** full value of the asset in piasters (integer string) */
  valuePiasters: string;
  /** decedent's ownership share, e.g. "1/1", "1/2" */
  ownership: string;
}

export interface Receivable {
  id: string;
  label: string;
  amountPiasters: string;
  status: "proven_collectible" | "doubtful";
}

export interface Debt {
  id: string;
  kind: "debt" | "deferred_mahr" | "other";
  label: string;
  amountPiasters: string;
  proven: boolean;
}

export interface Will {
  id: string;
  beneficiary: string;
  beneficiaryIsHeir: boolean;
  /** the beneficiary is also entitled to an obligatory bequest (Art. 77) */
  beneficiaryIsWajibaEntitled: boolean;
  mode: "amount" | "fraction";
  amountPiasters?: string;
  fraction?: string; // "1/4"
}

export interface Estate {
  fractionOnly: boolean;
  assets: Asset[];
  receivables: Receivable[];
  debts: Debt[];
  funeralPiasters: string;
  wills: Will[];
  /** consent of heirs to wills exceeding the available third */
  excessConsent: "none" | "all" | "partial";
}

export interface CaseMeta {
  title?: string;
  deceasedName?: string;
  deceasedGender: Gender;
  deathDate?: string; // ISO
  deceasedIsMuslim: boolean;
  confirmDeceased: boolean;
  framework: "EG";
}

export interface CaseInput {
  schema: 1;
  meta: CaseMeta;
  estate: Estate;
  family: Family;
  flags: Flags;
}

/* ------------------------------ engine core ------------------------------ */

/** Pure counts for the share engine — fully determined (no "unknown"). */
export interface HeirCounts {
  husband: number; // 0/1
  wives: number; // 0..4
  father: number;
  mother: number;
  gf: number;
  gm: { mm: number; fm: number; mmm: number; fmm: number; ffm: number };
  /** male-line descendant levels: index 0 = children (level 1), 1 = son's children... */
  desc: { sons: number; daughters: number }[];
  fullB: number;
  fullS: number;
  patB: number;
  patS: number;
  matB: number;
  matS: number;
  fullN: number;
  patN: number;
  fullNS: number;
  patNS: number;
  fullU: number;
  patU: number;
  fullC: number;
  patC: number;
  fullCS: number;
  patCS: number;
  distantKin: boolean;
}

export type Basis =
  | "fard"
  | "asaba_nafs"
  | "asaba_ghayr"
  | "asaba_maa_ghayr"
  | "fard_asaba"
  | "fard_radd"
  | "mushtaraka"
  | "blocked"
  | "none";

export interface GroupShare {
  key: GroupKey;
  label: string;
  count: number;
  gender: Gender | "mixed";
  basis: Basis;
  /** fraction of the inheritance pool for the whole group */
  total: Fraction;
  /** original fard before awl/radd, if any */
  fard?: Fraction;
  perPerson: Fraction;
  reason: string;
  ruleIds: string[];
}

export type GroupKey =
  | "husband"
  | "wives"
  | "father"
  | "mother"
  | "gf"
  | `gm_${"mm" | "fm" | "mmm" | "fmm" | "ffm"}`
  | `desc${number}_${"m" | "f"}`
  | "fullB"
  | "fullS"
  | "patB"
  | "patS"
  | "matB"
  | "matS"
  | "fullN"
  | "patN"
  | "fullNS"
  | "patNS"
  | "fullU"
  | "patU"
  | "fullC"
  | "patC"
  | "fullCS"
  | "patCS"
  | "treasury"
  | "distantKin";

export interface Step {
  ruleId?: string;
  text: string;
}

export interface Issue {
  code: string;
  severity: "stop" | "review" | "info";
  message: string;
  needed?: string;
}

export interface ShareResult {
  groups: GroupShare[]; // includes blocked groups (total 0)
  steps: Step[];
  issues: Issue[];
  /** أصل المسألة (LCM of fard denominators) */
  base: bigint;
  /** عالت إلى */
  awlTo?: bigint;
  radd: boolean;
  /** تصحيح المسألة: common denominator for all per-person shares */
  tashih: bigint;
  special: string[];
  residueTo?: "treasury" | "distantKin";
}
