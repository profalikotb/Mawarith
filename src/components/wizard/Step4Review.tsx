"use client";
import { useMemo } from "react";
import { evaluateCase, validateCase, type CaseInput, type Tri } from "@/engine";
import KinshipTree from "../KinshipTree";
import { Card, IssueList, Seg, TriToggle } from "../ui";
import { applyUnknown, type Update } from "./shared";

type FlagKey = keyof CaseInput["flags"];
const FLAGS: { k: Exclude<FlagKey, "pregnancyRelation">; q: string; h?: string }[] = [
  { k: "pregnancy", q: "هل يوجد حمل قد يرث من المتوفى؟", h: "مثل حمل الزوجة من المتوفى، أو حمل آخر قد يكون وارثًا." },
  { k: "missingPerson", q: "هل يوجد مفقود أو شخص لا تُعرف حياته وقت الوفاة؟" },
  { k: "simultaneousDeath", q: "هل توجد وفاة متزامنة أو ترتيب وفيات غير معلوم (حادث واحد مثلًا)؟" },
  { k: "heirDiedAfter", q: "هل توفي أحد الورثة بعد المورث وقبل القسمة؟", h: "تنتقل حصته إلى ورثته (مناسخة)." },
  { k: "nasabDispute", q: "هل يوجد نزاع في نسب أحد الأقارب؟" },
  { k: "marriageDispute", q: "هل يوجد نزاع في الزوجية؟" },
  { k: "divorceIssue", q: "هل يوجد طلاق قد يؤثر في الاستحقاق؟" },
  { k: "impediment", q: "هل يُحتمل وجود مانع إرث لأحد الأقارب؟", h: "مثل قتل المورث عمدًا، أو اختلاف الدين." },
  { k: "minors", q: "هل يوجد قاصر أو ناقص أهلية بين المستحقين؟", h: "لا يغيّر الأنصبة، لكنه يؤثر في الإجازة والتخارج." },
  { k: "disputedWill", q: "هل توجد وصية متنازع عليها؟" },
  { k: "foreignAssets", q: "هل توجد أصول خارج مصر أو تخضع لأكثر من نظام قانوني؟" },
];

export default function Step4Review({ c, update }: { c: CaseInput; update: Update }) {
  const ev = useMemo(() => evaluateCase(c), [c]);
  const conflicts = useMemo(() => validateCase(c).filter((i) => ["DATE_CONFLICT", "DUP_NAME", "SPOUSE_GENDER", "DEATH_FUTURE", "NOT_CONFIRMED", "NON_MUSLIM"].includes(i.code)), [c]);
  return (
    <>
      <Card title="شجرة القرابة" icon="④">
        <p className="small muted">راجع العلاقات كما أدخلتها. الشجرة للعرض فقط ولا تغني عن الأسئلة الشرعية.</p>
        <KinshipTree c={c} />
      </Card>

      <Card title="مساعد استكمال البيانات" icon="✦">
        {ev.material.length === 0 ? (
          <div className="alert ok">
            <span className="ic">✓</span>
            <div>
              لا توجد معلومات ناقصة مؤثرة في القسمة.
              {ev.immaterial.length > 0 && <span className="small muted"> (لم يُحسم: {ev.immaterial.map((u) => u.label).join("، ")} — ولا يؤثر في هذه المسألة.)</span>}
            </div>
          </div>
        ) : (
          <>
            <p>هذه المعلومات لم تُحسم وتؤثر في النتيجة. أجب عنها لإصدار حساب نهائي:</p>
            {ev.material.map((u) => (
              <div className="qrow" key={u.id}>
                <div className="q">{u.question}</div>
                <div className="seg" role="group" aria-label={u.label}>
                  <button type="button" onClick={() => update((x) => applyUnknown(x, u.id, true))}>
                    نعم
                  </button>
                  <button type="button" onClick={() => update((x) => applyUnknown(x, u.id, false))}>
                    لا
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </Card>

      {conflicts.length > 0 && (
        <Card title="تعارضات في البيانات" icon="⚠">
          <IssueList issues={conflicts} />
        </Card>
      )}

      <Card title="حالات تحتاج احتياطًا" icon="⚑">
        <p className="small muted">هذه الحالات لا تُستنتج من وصف مختصر؛ الإجابة بـ«نعم» تجعل النتيجة مبدئية أو توقفها مع بيان السبب.</p>
        {FLAGS.map((fl) => (
          <div className="qrow" key={fl.k}>
            <div className="q">
              {fl.q}
              {fl.h && <small>{fl.h}</small>}
            </div>
            <TriToggle label={fl.q} labels={["نعم", "لا", "لا أعلم"]} value={c.flags[fl.k] as Tri} onChange={(v) => update((x) => void ((x.flags[fl.k] as Tri) = v))} />
            {fl.k === "pregnancy" && c.flags.pregnancy === "yes" && (
              <div className="extra">
                <Seg
                  label="نوع الحمل"
                  value={c.flags.pregnancyRelation}
                  options={[
                    { v: "decedent_child", t: "حمل من المتوفى (ولده)" },
                    { v: "other", t: "حمل آخر قد يرث" },
                  ]}
                  onChange={(v) => update((x) => void (x.flags.pregnancyRelation = v))}
                />
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card title="تأكيد نهائي" icon="✔">
        <div className="qrow">
          <div className="q">
            هل يوجد قريب آخر لم تتم إضافته وقد يؤثر في القسمة؟
            <small>مثل جد أو جدة أو أخ لأب أو ابن ابن أو عم.</small>
          </div>
          <TriToggle label="قريب آخر" labels={["نعم", "لا", "لا أعلم"]} value={c.family.otherRelative} onChange={(v) => update((x) => void (x.family.otherRelative = v))} />
        </div>
      </Card>
    </>
  );
}
