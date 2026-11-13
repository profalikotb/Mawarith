/**
 * التخارج (Art. 48 Law 77/1943) — a SEPARATE, optional layer applied on top of
 * the legal entitlements. It never changes the entitlement computation itself.
 */
import { Fraction } from "./fraction";

export interface TakharujInput {
  /** heirs with their legal share of the pool */
  heirs: { id: string; label: string; share: Fraction }[];
  exitingId: string;
  mode: "with_one" | "with_all_from_estate" | "with_all_own_money";
  /** for with_one: the heir who takes the exiting heir's place */
  withId?: string;
  /** for with_all_own_money: custom split agreed in the contract (fractions summing to 1) */
  agreedSplit?: Record<string, Fraction>;
  minorsInvolved: boolean;
}

export interface TakharujResult {
  rows: { id: string; label: string; before: Fraction; after: Fraction }[];
  notes: string[];
  ok: boolean;
}

export function applyTakharuj(t: TakharujInput): TakharujResult {
  const notes: string[] = [];
  const ex = t.heirs.find((h) => h.id === t.exitingId);
  if (!ex) return { rows: [], notes: ["الوارث الخارج غير موجود."], ok: false };
  const others = t.heirs.filter((h) => h.id !== t.exitingId && h.share.isPos());
  const after = new Map<string, Fraction>(t.heirs.map((h) => [h.id, h.share]));
  after.set(ex.id, Fraction.ZERO);

  if (t.mode === "with_one") {
    const w = others.find((h) => h.id === t.withId);
    if (!w) return { rows: [], notes: ["حدد الوارث الذي تم التخارج معه."], ok: false };
    after.set(w.id, w.share.add(ex.share));
    notes.push("تخارج وارث مع آخر: يحل الآخر محله في نصيبه (المادة 48).");
  } else if (t.mode === "with_all_from_estate") {
    const S = Fraction.sum(others.map((h) => h.share));
    for (const h of others) after.set(h.id, h.share.add(ex.share.mul(h.share).div(S)));
    notes.push("المدفوع للخارج من التركة: يُقسم نصيبه بين الباقين بنسبة أنصبائهم (المادة 48). يُخصم ما دُفع له من التركة قبل القسمة.");
  } else {
    if (t.agreedSplit) {
      const s = Fraction.sum(Object.values(t.agreedSplit));
      if (!s.eq(Fraction.ONE)) return { rows: [], notes: ["مجموع نسب القسمة المتفق عليها لا يساوي 1."], ok: false };
      for (const h of others) after.set(h.id, h.share.add(ex.share.mul(t.agreedSplit[h.id] ?? Fraction.ZERO)));
      notes.push("المدفوع من مال الورثة مع نص العقد على طريقة القسمة: يُقسم نصيب الخارج وفق الاتفاق.");
    } else {
      for (const h of others) after.set(h.id, h.share.add(ex.share.divInt(others.length)));
      notes.push("المدفوع من مال الورثة ولم ينص العقد على طريقة القسمة: يُقسم نصيب الخارج بينهم بالسوية (المادة 48).");
    }
  }
  if (t.minorsInvolved)
    notes.push("يوجد قاصر طرف في التخارج: لا يصح إلا بإذن الجهة المختصة بالولاية على المال، ويُراعى ألا يكون فيه غبن على القاصر.");
  notes.push("التخارج اتفاق لاحق على أصل الاستحقاق؛ يلزم تسجيله وإثباته، ولا يغيّر الأنصبة الشرعية المحسوبة.");
  return {
    rows: t.heirs.map((h) => ({ id: h.id, label: h.label, before: h.share, after: after.get(h.id)! })),
    notes,
    ok: true,
  };
}
