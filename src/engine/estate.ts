import { Fraction } from "./fraction";
import { pi } from "./money";
import type { Estate, Issue, Step } from "./types";

export interface EstateSummary {
  fractionOnly: boolean;
  assetsGross: bigint; // decedent's share of assets
  assetLines: { id: string; label: string; kind: string; full: bigint; ownership: string; included: bigint }[];
  receivablesIncluded: bigint;
  receivablesDoubtful: bigint;
  totalEstate: bigint; // assets + collectible receivables
  funeral: bigint;
  debtsProven: bigint;
  debtsExcluded: { label: string; amount: bigint; why: string }[];
  /** after funeral and debts — base for the third and for wills */
  netBeforeWills: bigint;
  insolvent: boolean;
  steps: Step[];
  issues: Issue[];
}

export function summarizeEstate(e: Estate): EstateSummary {
  const steps: Step[] = [];
  const issues: Issue[] = [];
  const assetLines = e.assets.map((a) => {
    let own: Fraction;
    try {
      own = Fraction.parse(a.ownership || "1");
    } catch {
      own = Fraction.ONE;
      issues.push({ code: "OWNERSHIP_PARSE", severity: "stop", message: `نسبة الملكية غير صحيحة في «${a.label}».`, needed: "أدخل نسبة مثل 1/2." });
    }
    if (own.isNeg() || own.gt(Fraction.ONE)) {
      issues.push({ code: "OWNERSHIP_RANGE", severity: "stop", message: `نسبة الملكية في «${a.label}» يجب أن تكون بين 0 و1.` });
    }
    const full = pi(a.valuePiasters);
    const inc = own.mul(new Fraction(full));
    return { id: a.id, label: a.label, kind: a.kind, full, ownership: own.toString(), included: inc.n / inc.d };
  });
  const assetsGross = assetLines.reduce((s, x) => s + x.included, 0n);
  let receivablesIncluded = 0n;
  let receivablesDoubtful = 0n;
  for (const r of e.receivables) {
    if (r.status === "proven_collectible") receivablesIncluded += pi(r.amountPiasters);
    else receivablesDoubtful += pi(r.amountPiasters);
  }
  if (receivablesDoubtful > 0n) {
    issues.push({
      code: "RECEIVABLE_DOUBTFUL",
      severity: "info",
      message: "توجد ديون مستحقة للمتوفى غير ثابتة أو غير مضمونة التحصيل؛ لم تدخل في الحساب، وتوزع بالنسب نفسها عند تحصيلها.",
    });
  }
  const totalEstate = assetsGross + receivablesIncluded;
  const funeral = pi(e.funeralPiasters);
  let debtsProven = 0n;
  const debtsExcluded: EstateSummary["debtsExcluded"] = [];
  for (const d of e.debts) {
    const amt = pi(d.amountPiasters);
    if (d.proven) debtsProven += amt;
    else
      debtsExcluded.push({
        label: d.label,
        amount: amt,
        why: d.kind === "deferred_mahr" ? "مؤخر صداق لم يُؤكَّد ثبوته واستحقاقه" : "دين لم يُؤكَّد ثبوته",
      });
  }
  if (debtsExcluded.length) {
    issues.push({
      code: "DEBT_UNPROVEN",
      severity: "review",
      message: "توجد التزامات لم يُؤكَّد ثبوتها فلم تُخصم؛ إن ثبتت تغيرت النتيجة المالية.",
    });
  }
  const netBeforeWills = totalEstate - funeral - debtsProven;
  const insolvent = !e.fractionOnly && netBeforeWills <= 0n;
  if (!e.fractionOnly) {
    steps.push({ ruleId: "EG77-4", text: "يُبدأ من التركة بتجهيز الميت، ثم سداد ديونه الثابتة، ثم تنفيذ الوصايا في حدها، والباقي للورثة (المادة 4)." });
    if (insolvent) {
      issues.push({
        code: "INSOLVENT",
        severity: "info",
        message: "الديون ومصروفات التجهيز تستغرق التركة؛ لا يوجد مال قابل للتوزيع ميراثًا ولا تنفذ الوصايا.",
      });
      steps.push({ ruleId: "EG71-38", text: "التركة مستغرقة بالديون؛ فلا ميراث ولا تنفيذ للوصايا إلا بعد براءة الذمة." });
    }
  }
  return {
    fractionOnly: e.fractionOnly,
    assetsGross,
    assetLines,
    receivablesIncluded,
    receivablesDoubtful,
    totalEstate,
    funeral,
    debtsProven,
    debtsExcluded,
    netBeforeWills,
    insolvent,
    steps,
    issues,
  };
}
