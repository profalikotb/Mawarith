/**
 * Obligatory bequest (الوصية الواجبة — Law 71/1946 arts. 76–78) and optional
 * bequests (arts. 37, 79). All values are fractions of the net estate after
 * funeral expenses and debts ("N").
 */
import { Fraction, F } from "./fraction";
import { computeShares } from "./shares";
import { relationText } from "./derive";
import { pi } from "./money";
import type { Descendant, HeirCounts, Issue, ShareResult, Step, Will } from "./types";

export interface WajibaBeneficiary {
  id: string;
  name?: string;
  relation: string;
  rootId: string;
  rootLabel: string;
  /** entitlement before gift deduction (fraction of N) */
  entitled: Fraction;
  /** after deducting gifts (fraction of N) */
  due: Fraction;
  giftPiasters: bigint;
}

export interface WajibaResult {
  applies: boolean;
  roots: { id: string; name?: string; label: string; hypothetical: Fraction; capped: Fraction }[];
  hypotheticalTotal: Fraction;
  capApplied: boolean;
  beneficiaries: WajibaBeneficiary[];
  total: Fraction; // Σ due
  hypotheticalShares?: ShareResult;
  steps: Step[];
  issues: Issue[];
}

interface Leaf {
  node: Descendant;
  path: ("male" | "female")[];
}

type Weighted = { weight: number; leaf?: Leaf; sub?: Weighted[]; node: Descendant; path: ("male" | "female")[] };

const isAliveAtDeath = (d: Descendant) => d.status === "alive" || d.status === "died_after";
const isDeadForWajiba = (d: Descendant) => d.status === "predeceased" || d.status === "simultaneous";

/**
 * Build the beneficiary tree for a root (predeceased child of the decedent).
 * - daughter's line: only her first layer of children
 * - son's line: male-line descendants however low; a predeceased male inside the
 *   line is represented by his own branch; predeceased females are dropped.
 */
function buildBranch(root: Descendant, actualShare: (id: string) => Fraction | undefined): { tree: Weighted[]; heirsInside: string[] } {
  const heirsInside: string[] = [];
  const rec = (node: Descendant, path: ("male" | "female")[], allowDeeper: boolean): Weighted[] => {
    const out: Weighted[] = [];
    for (const c of node.children) {
      const cp = [...path, c.gender];
      const w = c.gender === "male" ? 2 : 1;
      if (isAliveAtDeath(c)) {
        const s = actualShare(c.id);
        if (s && s.isPos()) {
          heirsInside.push(c.id);
          continue;
        }
        out.push({ weight: w, leaf: { node: c, path: cp }, node: c, path: cp });
      } else if (isDeadForWajiba(c) && allowDeeper && c.gender === "male") {
        const sub = rec(c, cp, true);
        if (sub.length) out.push({ weight: w, sub, node: c, path: cp });
      }
    }
    return out;
  };
  const tree = rec(root, [root.gender], root.gender === "male");
  return { tree, heirsInside };
}

function distribute(tree: Weighted[], amount: Fraction, out: { leaf: Leaf; share: Fraction }[]) {
  const units = tree.reduce((s, w) => s + w.weight, 0);
  for (const w of tree) {
    const part = amount.mulInt(w.weight).divInt(units);
    if (w.leaf) out.push({ leaf: w.leaf, share: part });
    else if (w.sub) distribute(w.sub, part, out);
  }
}

export function computeWajiba(
  counts: HeirCounts,
  roots: Descendant[],
  actual: ShareResult,
  actualPersonShare: (id: string) => Fraction | undefined,
  net: bigint | null,
): WajibaResult {
  const steps: Step[] = [];
  const issues: Issue[] = [];
  const empty: WajibaResult = {
    applies: false,
    roots: [],
    hypotheticalTotal: Fraction.ZERO,
    capApplied: false,
    beneficiaries: [],
    total: Fraction.ZERO,
    steps,
    issues,
  };
  if (!roots.length) return empty;

  const considered: { root: Descendant; tree: Weighted[] }[] = [];
  for (const r of roots) {
    const { tree, heirsInside } = buildBranch(r, actualPersonShare);
    if (heirsInside.length && tree.length) {
      issues.push({
        code: "WAJIBA_MIXED",
        severity: "stop",
        message: `فرع «${r.name || relationText([r.gender])}» يضم ورثة فعليين ومستحقين محتملين للوصية الواجبة معًا؛ هذه الحالة تحتاج إلى مراجعة متخصص.`,
        needed: "عرض المسألة على متخصص.",
      });
      continue;
    }
    if (heirsInside.length && !tree.length) {
      steps.push({
        ruleId: "EG71-76",
        text: `فرع «${r.name || relationText([r.gender])}» وارث فعلًا، فلا وصية واجبة له (يشترط أن يكون المستحق غير وارث).`,
      });
      continue;
    }
    if (tree.length) considered.push({ root: r, tree });
  }
  void actual;
  if (!considered.length) return { ...empty, steps, issues };

  // hypothetical: the predeceased children are assumed alive at the decedent's death
  const hypo: HeirCounts = JSON.parse(JSON.stringify(counts));
  for (const c of considered) {
    if (c.root.gender === "male") hypo.desc[0].sons++;
    else hypo.desc[0].daughters++;
  }
  const hr = computeShares(hypo);
  const perSon = hr.groups.find((g) => g.key === "desc1_m")?.perPerson ?? Fraction.ZERO;
  const perDau = hr.groups.find((g) => g.key === "desc1_f")?.perPerson ?? Fraction.ZERO;
  steps.push({
    ruleId: "EG71-76",
    text: `نفترض حياة ${considered
      .map((c) => `«${c.root.name || relationText([c.root.gender])}»`)
      .join(" و")} وقت وفاة المورث ونحسب نصيب كلٍّ ميراثًا (حساب افتراضي).`,
  });
  const rootsOut = considered.map((c) => ({
    id: c.root.id,
    name: c.root.name,
    label: relationText([c.root.gender]),
    hypothetical: c.root.gender === "male" ? perSon : perDau,
    capped: Fraction.ZERO,
  }));
  const W = Fraction.sum(rootsOut.map((r) => r.hypothetical));
  const third = F(1, 3);
  const capApplied = W.gt(third);
  const factor = capApplied ? third.div(W) : Fraction.ONE;
  for (const r of rootsOut) r.capped = r.hypothetical.mul(factor);
  steps.push({
    ruleId: "EG71-76",
    text: capApplied
      ? `مجموع الأنصبة الافتراضية ${W.toString()} يزيد على الثلث، فتُرد الوصية الواجبة إلى الثلث وتقسم بين الفروع بنسبة أنصبة أصولهم.`
      : `مجموع الأنصبة الافتراضية ${W.toString()} لا يزيد على الثلث، فيكون هو مقدار الوصية الواجبة.`,
  });

  const beneficiaries: WajibaBeneficiary[] = [];
  for (const c of considered) {
    const ro = rootsOut.find((x) => x.id === c.root.id)!;
    const leaves: { leaf: Leaf; share: Fraction }[] = [];
    distribute(c.tree, ro.capped, leaves);
    for (const l of leaves) {
      const gift = pi(l.leaf.node.giftPiasters);
      let due = l.share;
      if (gift > 0n) {
        if (net === null) {
          issues.push({
            code: "GIFT_NEEDS_VALUE",
            severity: "stop",
            message: "لخصم ما أعطاه المورث للمستحق بغير عوض يلزم إدخال قيمة التركة.",
            needed: "أدخل قيم التركة أو احذف قيمة الهبة.",
          });
        } else if (net > 0n) {
          const giftFr = new Fraction(gift, net);
          due = l.share.sub(giftFr);
          if (due.isNeg()) due = Fraction.ZERO;
          steps.push({
            ruleId: "EG71-76",
            text: `خُصم من وصية «${l.leaf.node.name || relationText(l.leaf.path)}» ما أعطاه المورث له بغير عوض.`,
          });
        }
      }
      beneficiaries.push({
        id: l.leaf.node.id,
        name: l.leaf.node.name,
        relation: relationText(l.leaf.path),
        rootId: c.root.id,
        rootLabel: c.root.name || relationText([c.root.gender]),
        entitled: l.share,
        due,
        giftPiasters: gift,
      });
    }
    // notes for excluded descendants (deeper daughter lines)
    if (c.root.gender === "female" && c.root.children.some((x) => x.children.length && !isAliveAtDeath(x))) {
      steps.push({ ruleId: "EG71-76", text: "الوصية الواجبة في فرع البنت لأهل الطبقة الأولى من أولادها فقط." });
    }
  }
  const total = Fraction.sum(beneficiaries.map((b) => b.due));
  steps.push({ ruleId: "EG71-76", text: "يقسم نصيب كل أصل على فرعه قسمة الميراث (للذكر مثل حظ الأنثيين)، ويحجب كل أصل فرعه دون فرع غيره." });
  return {
    applies: beneficiaries.length > 0,
    roots: rootsOut,
    hypotheticalTotal: W,
    capApplied,
    beneficiaries,
    total,
    hypotheticalShares: hr,
    steps,
    issues,
  };
}

export interface WillExec {
  id: string;
  beneficiary: string;
  beneficiaryIsHeir: boolean;
  requested: Fraction; // of N
  executed: Fraction; // of N
}

export interface WillsResult {
  wills: WillExec[];
  requestedTotal: Fraction;
  executedTotal: Fraction;
  capacity: Fraction;
  steps: Step[];
  issues: Issue[];
}

export function computeOptionalWills(
  wills: Will[],
  wajibaTotal: Fraction,
  net: bigint | null,
  consent: "none" | "all" | "partial",
  minorsPresent: boolean,
): WillsResult {
  const steps: Step[] = [];
  const issues: Issue[] = [];
  const third = F(1, 3);
  const capacity = third.sub(wajibaTotal).max(Fraction.ZERO);
  const execs: WillExec[] = [];
  for (const w of wills) {
    let req = Fraction.ZERO;
    if (w.mode === "fraction") {
      try {
        req = Fraction.parse(w.fraction || "0");
      } catch {
        issues.push({ code: "WILL_PARSE", severity: "stop", message: `كسر الوصية غير صحيح: «${w.beneficiary}».` });
      }
    } else {
      const amt = pi(w.amountPiasters);
      if (net === null) {
        issues.push({ code: "WILL_NEEDS_VALUE", severity: "stop", message: "وصية بمبلغ محدد تحتاج إلى إدخال قيمة التركة.", needed: "أدخل قيمة التركة أو اكتب الوصية ككسر." });
      } else if (net > 0n) req = new Fraction(amt, net);
    }
    if (w.beneficiaryIsWajibaEntitled) {
      issues.push({
        code: "WILL_TO_WAJIBA",
        severity: "review",
        message: `الوصية لـ«${w.beneficiary}» وهو من مستحقي الوصية الواجبة: تُحتسب من نصيبه الواجب ويكمل له النقص أو تكون الزيادة اختيارية (المادة 77). راجع الحساب مع متخصص.`,
      });
    }
    execs.push({ id: w.id, beneficiary: w.beneficiary, beneficiaryIsHeir: w.beneficiaryIsHeir, requested: req, executed: req });
  }
  const requestedTotal = Fraction.sum(execs.map((x) => x.requested));
  if (!execs.length) return { wills: [], requestedTotal, executedTotal: Fraction.ZERO, capacity, steps, issues };

  if (wajibaTotal.isPos()) steps.push({ ruleId: "EG71-78", text: "الوصية الواجبة مقدمة على الوصايا الاختيارية، وما بقي من الثلث يتسع للوصايا الاختيارية." });
  if (execs.some((x) => x.beneficiaryIsHeir)) {
    steps.push({ ruleId: "EG71-37", text: "الوصية للوارث في حدود الثلث نافذة دون إجازة الورثة وفق القانون المصري." });
  }
  let executedTotal = requestedTotal;
  if (requestedTotal.gt(capacity)) {
    if (consent === "all" && !minorsPresent) {
      const maxAll = Fraction.ONE.sub(wajibaTotal);
      if (requestedTotal.gt(maxAll)) {
        for (const x of execs) x.executed = x.requested.mul(maxAll).div(requestedTotal);
        executedTotal = maxAll;
      }
      steps.push({ ruleId: "EG71-37", text: "الوصايا تزيد على الثلث المتاح، وقد أجاز جميع الورثة الزيادة بعد الوفاة وهم أهل للتبرع، فتنفذ." });
      issues.push({
        code: "WILL_CONSENT_CHECK",
        severity: "review",
        message: "نفاذ ما زاد على الثلث مبني على إجازة جميع الورثة بعد الوفاة وهم من أهل التبرع عالمين بما يجيزونه؛ تحقق من ثبوت الإجازة.",
      });
    } else {
      for (const x of execs) x.executed = capacity.isZero() ? Fraction.ZERO : x.requested.mul(capacity).div(requestedTotal);
      executedTotal = capacity;
      steps.push({
        ruleId: "EG71-79",
        text: `الوصايا الاختيارية (${requestedTotal.toString()}) تزيد على المتاح من الثلث (${capacity.toString()})، فتنفذ في حدوده وتقسم بالمحاصة.`,
      });
      if (consent !== "none" || minorsPresent) {
        issues.push({
          code: "WILL_PARTIAL_CONSENT",
          severity: "review",
          message:
            "إجازة بعض الورثة أو وجود قاصر: لا تُعتبر إجازة القاصر أو ناقص الأهلية، وتنفذ الزيادة في حصة المجيز فقط. نُفذت الوصايا هنا في حدود الثلث فقط؛ يلزم حساب أثر الإجازة الجزئية لدى متخصص.",
        });
      }
    }
  }
  return { wills: execs, requestedTotal, executedTotal, capacity, steps, issues };
}
