/**
 * Full case pipeline: validation → estate → heir derivation → wajiba →
 * optional wills → shares → money allocation → explanation.
 */
import { Fraction, lcm } from "./fraction";
import { deriveCounts, type Assumptions, type UnknownItem } from "./derive";
import { summarizeEstate, type EstateSummary } from "./estate";
import { groupLabel, groupOrder, singularLabel } from "./labels";
import { allocate } from "./money";
import { ENGINE_VERSION, RULESET_VERSION } from "./rules";
import { computeShares } from "./shares";
import type { Basis, CaseInput, Issue, ShareResult, Step } from "./types";
import { validateCase } from "./validate";
import { computeOptionalWills, computeWajiba, type WajibaResult, type WillsResult } from "./wills";

export type Role = "heir" | "blocked" | "excluded" | "wajiba" | "will" | "treasury";

export interface PersonResult {
  id: string;
  name?: string;
  relation: string;
  groupKey: string;
  groupLabel: string;
  groupCount: number;
  role: Role;
  basis: Basis | "wajiba" | "will";
  reason: string;
  /** share of the heirs' inheritance pool (heirs only) */
  shareOfPool?: Fraction;
  groupShareOfPool?: Fraction;
  /** effective share of the net estate (after debts) */
  shareOfNet: Fraction;
  sahm?: bigint; // out of result.tashih (pool)
  sahmNet?: bigint; // out of result.tashihNet
  amount?: bigint; // piasters
  ruleIds: string[];
  note?: string;
  diedAfter?: boolean;
}

export type Status = "final" | "preliminary" | "stopped" | "incomplete";

export interface CaseResult {
  engineVersion: string;
  rulesetVersion: string;
  computedAt: string;
  status: Status;
  issues: Issue[];
  unknowns: UnknownItem[];
  estate: EstateSummary;
  wajiba: WajibaResult;
  wills: WillsResult;
  shares: ShareResult;
  /** fraction of N going to heirs */
  pool: Fraction;
  persons: PersonResult[];
  tashihNet: bigint;
  steps: Step[];
  balanceOk: boolean;
}

const BASIS_TEXT: Record<string, string> = {
  fard: "فرضًا",
  asaba_nafs: "تعصيبًا بالنفس",
  asaba_ghayr: "تعصيبًا بالغير",
  asaba_maa_ghayr: "تعصيبًا مع الغير",
  fard_asaba: "فرضًا وتعصيبًا",
  fard_radd: "فرضًا وردًّا",
  mushtaraka: "بالتشريك (المشتركة)",
  blocked: "محجوب",
  wajiba: "وصية واجبة",
  will: "وصية اختيارية",
  none: "—",
};
export const basisText = (b: string) => BASIS_TEXT[b] ?? b;

export function calculateCase(input: CaseInput, assumptions: Assumptions = {}, now = new Date()): CaseResult {
  const issues: Issue[] = [...validateCase(input)];
  const estate = summarizeEstate(input.estate);
  issues.push(...estate.issues);
  const d = deriveCounts(input, assumptions);
  issues.push(...d.issues);

  const net: bigint | null = input.estate.fractionOnly ? null : estate.netBeforeWills;

  // actual shares (without wajiba) — needed to test "غير وارث"
  const shares = computeShares(d.counts);
  issues.push(...shares.issues);

  // remote agnates: only matter when nobody takes the residue as agnate
  const anyAsaba = shares.groups.some((g) => g.basis.startsWith("asaba") || g.basis === "fard_asaba");
  if (!anyAsaba && input.family.remoteAgnates !== "no") {
    const residueSoaked = shares.radd || shares.residueTo;
    if (residueSoaked) {
      issues.push({
        code: input.family.remoteAgnates === "yes" ? "REMOTE_AGNATES" : "REMOTE_AGNATES_UNKNOWN",
        severity: "stop",
        message:
          input.family.remoteAgnates === "yes"
            ? "يوجد عاصب أبعد (كعم الأب أو ابنه) ولا عاصب أقرب؛ هذا الإصدار لا يحسب العصبات الأبعد من أبناء أبناء الأعمام."
            : "لا يوجد عاصب مدخل، ولم يُحسم وجود عصبات أبعد (كأعمام الأب وأبنائهم)؛ وجودهم يغيّر القسمة (يمنع الرد).",
        needed: "حدد وجود العصبات الأبعد أو اعرض المسألة على متخصص.",
      });
    }
  }

  const groupByKey = new Map(shares.groups.map((g) => [g.key as string, g]));
  const personShare = (id: string): Fraction | undefined => {
    const seed = d.persons.find((p) => p.id === id);
    if (!seed) return undefined;
    return groupByKey.get(seed.groupKey)?.perPerson;
  };

  const wajiba =
    estate.insolvent
      ? computeWajiba(d.counts, [], shares, personShare, net)
      : computeWajiba(d.counts, d.wajibaRoots, shares, personShare, net);
  issues.push(...wajiba.issues);

  const minors = input.flags.minors === "yes";
  const wills = estate.insolvent
    ? computeOptionalWills([], wajiba.total, net, input.estate.excessConsent, minors)
    : computeOptionalWills(input.estate.wills, wajiba.total, net, input.estate.excessConsent, minors);
  issues.push(...wills.issues);

  const pool = Fraction.ONE.sub(wajiba.total).sub(wills.executedTotal);

  /* persons */
  const persons: PersonResult[] = [];
  for (const seed of d.persons) {
    const g = groupByKey.get(seed.groupKey);
    if (!g) continue;
    const blocked = g.basis === "blocked";
    const zero = !g.perPerson.isPos();
    persons.push({
      id: seed.id,
      name: seed.name,
      relation: singularLabel(seed.groupKey),
      groupKey: seed.groupKey,
      groupLabel: groupLabel(seed.groupKey, g.count),
      groupCount: g.count,
      role: blocked ? "blocked" : "heir",
      basis: g.basis,
      reason: zero && !blocked ? `${g.reason}` : g.reason,
      shareOfPool: g.perPerson,
      groupShareOfPool: g.total,
      shareOfNet: g.perPerson.mul(pool),
      ruleIds: g.ruleIds,
      note: seed.note,
      diedAfter: seed.diedAfter,
    });
  }
  for (const ex of d.excluded) {
    persons.push({
      id: ex.id,
      name: ex.name,
      relation: ex.relation,
      groupKey: "excluded",
      groupLabel: ex.relation,
      groupCount: 1,
      role: "excluded",
      basis: "none",
      reason: ex.reason,
      shareOfNet: Fraction.ZERO,
      ruleIds: [ex.ruleId],
    });
  }
  for (const b of wajiba.beneficiaries) {
    // a wajiba beneficiary may also appear as a (blocked/zero) heir — keep both rows, mark the heir row
    persons.push({
      id: `wajiba:${b.id}`,
      name: b.name,
      relation: b.relation,
      groupKey: "wajiba",
      groupLabel: `فرع ${b.rootLabel}`,
      groupCount: 1,
      role: "wajiba",
      basis: "wajiba",
      reason: `وصية واجبة بقدر نصيب أصله «${b.rootLabel}» المتوفى قبل المورث${b.giftPiasters > 0n ? "، بعد خصم ما أعطاه المورث له بغير عوض" : ""}`,
      shareOfNet: b.due,
      ruleIds: ["EG71-76", ...(wajiba.capApplied ? ["EG71-78"] : [])],
    });
  }
  for (const w of wills.wills) {
    persons.push({
      id: `will:${w.id}`,
      name: w.beneficiary,
      relation: w.beneficiaryIsHeir ? "موصى له (وارث)" : "موصى له",
      groupKey: "will",
      groupLabel: "الوصايا الاختيارية",
      groupCount: 1,
      role: "will",
      basis: "will",
      reason: w.executed.eq(w.requested) ? "وصية اختيارية نافذة" : "وصية اختيارية نافذة جزئيًا في حدود الثلث",
      shareOfNet: w.executed,
      ruleIds: ["EG71-37", "EG71-79"],
    });
  }
  if (shares.residueTo === "treasury" && pool.isPos()) {
    persons.push({
      id: "treasury",
      relation: "الخزانة العامة",
      groupKey: "treasury",
      groupLabel: "الخزانة العامة",
      groupCount: 1,
      role: "treasury",
      basis: "none",
      reason: "لا وارث ولا مقر له بنسب (المادة 4)",
      shareOfNet: pool,
      ruleIds: ["EG77-TREASURY"],
    });
  }

  // deterministic ordering
  const roleOrder: Record<Role, number> = { wajiba: 0, will: 1, heir: 2, blocked: 3, excluded: 4, treasury: 5 };
  persons.sort(
    (a, b) =>
      roleOrder[a.role] - roleOrder[b.role] ||
      groupOrder(a.groupKey) - groupOrder(b.groupKey) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  /* sahm (shares) */
  let tashihNet = 1n;
  for (const p of persons) if (p.shareOfNet.isPos()) tashihNet = lcm(tashihNet, p.shareOfNet.d);
  for (const p of persons) {
    if (p.shareOfPool && p.shareOfPool.isPos()) p.sahm = (p.shareOfPool.n * shares.tashih) / p.shareOfPool.d;
    if (p.shareOfNet.isPos()) p.sahmNet = (p.shareOfNet.n * tashihNet) / p.shareOfNet.d;
  }

  /* money */
  if (net !== null && net > 0n) {
    const items = persons
      .filter((p) => p.shareOfNet.isPos())
      .map((p, i) => ({ key: p.id, order: i, fraction: p.shareOfNet }));
    const alloc = allocate(net, items);
    for (const p of persons) p.amount = alloc.get(p.id) ?? 0n;
  } else if (net !== null) {
    for (const p of persons) p.amount = 0n;
  }

  /* balance check */
  const distributed = Fraction.sum(persons.map((p) => p.shareOfNet));
  const expect = shares.residueTo === "distantKin" ? null : Fraction.ONE;
  let balanceOk = expect ? distributed.eq(expect) : true;
  if (persons.some((p) => p.shareOfNet.isNeg() || (p.amount ?? 0n) < 0n)) balanceOk = false;
  if (net !== null && net > 0n && expect) {
    const sumAmt = persons.reduce((s, p) => s + (p.amount ?? 0n), 0n);
    if (sumAmt !== net) balanceOk = false;
  }
  if (estate.insolvent) balanceOk = true;
  if (!balanceOk && !shares.residueTo) {
    issues.push({ code: "BALANCE_FAIL", severity: "stop", message: "فشل التحقق من اتزان التوزيع (خطأ داخلي)." });
  }

  /* munasakha */
  const after = persons.filter((p) => p.diedAfter && p.shareOfNet.isPos());
  if (after.length || input.flags.heirDiedAfter === "yes") {
    issues.push({
      code: "MUNASAKHA",
      severity: "review",
      message: `يوجد وارث توفي بعد المورث${after.length ? ` (${after.map((p) => p.name || p.relation).join("، ")})` : ""}: يُستحق نصيبه هنا ثم ينتقل إلى ورثته بقسمة مستقلة (مناسخة). هذا الإصدار لا يجمع المناسخات آليًا.`,
      needed: "احسب تركة الوارث المتوفى كمسألة جديدة مستقلة، أو اعرضها على متخصص.",
    });
  }

  /* steps */
  const steps: Step[] = [...estate.steps, ...wajiba.steps, ...wills.steps, ...shares.steps];
  if (net !== null && net > 0n) steps.push({ ruleId: "APP-ROUNDING", text: "حُوِّلت الكسور الدقيقة إلى قروش بطريقة أكبر الباقي، ومجموع المبالغ يساوي صافي التركة تمامًا." });

  /* status */
  const dedup = new Map<string, Issue>();
  for (const i of issues) if (!dedup.has(i.code + i.message)) dedup.set(i.code + i.message, i);
  const finalIssues = [...dedup.values()];
  let status: Status = "final";
  if (d.unknowns.length) status = "incomplete";
  else if (finalIssues.some((i) => i.severity === "stop")) status = "stopped";
  else if (finalIssues.some((i) => i.severity === "review")) status = "preliminary";

  return {
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    computedAt: now.toISOString(),
    status,
    issues: finalIssues,
    unknowns: d.unknowns,
    estate,
    wajiba,
    wills,
    shares,
    pool,
    persons,
    tashihNet,
    steps,
    balanceOk,
  };
}
