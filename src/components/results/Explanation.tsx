"use client";
import { useState } from "react";
import { RULES, type CaseResult } from "@/engine";
import { dg, fmtFrac } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export function plainSummary(r: CaseResult): string {
  const heirs = r.persons.filter((p) => p.role === "heir" && p.shareOfNet.isPos());
  const blocked = r.persons.filter((p) => p.role === "blocked");
  const parts: string[] = [];
  if (r.wajiba.applies) parts.push(`تُخرج أولًا وصية واجبة لأحفاد من ولد توفي قبل المورث مقدارها ${r.wajiba.total.toString()} من صافي التركة.`);
  if (r.wills.executedTotal.isPos()) parts.push(`وتنفذ الوصايا الاختيارية بمقدار ${r.wills.executedTotal.toString()}.`);
  if (heirs.length) parts.push(`يرث ${heirs.length === 1 ? "وارث واحد" : `${heirs.length} ورثة`}.`);
  if (r.shares.special.includes("العول")) parts.push(`زادت الفروض على التركة فعالت المسألة من ${r.shares.base} إلى ${r.shares.awlTo}، فنقص كل صاحب فرض بنسبة فرضه.`);
  if (r.shares.radd) parts.push("بقي من التركة شيء بعد الفروض ولا عاصب، فرُد على أصحاب الفروض.");
  if (r.shares.special.includes("المشتركة")) parts.push("المسألة مشتركة: شارك الأشقاء أولاد الأم في الثلث.");
  if (r.shares.special.includes("العمرية")) parts.push("المسألة من العمريتين: للأم ثلث الباقي بعد فرض الزوج أو الزوجة.");
  if (blocked.length) parts.push(`حُجب ${blocked.map((b) => b.name || b.relation).join("، ")} بوجود من هو أقرب.`);
  return parts.join(" ");
}

export default function Explanation({ r }: { r: CaseResult }) {
  const [open, setOpen] = useState(false);
  const { digits } = useSettings();
  return (
    <div>
      <p>{plainSummary(r)}</p>
      <div className="row small muted">
        <span>أصل المسألة: {dg(r.shares.base.toString(), digits)}</span>
        {r.shares.awlTo && <span>· عالت إلى: {dg(r.shares.awlTo.toString(), digits)}</span>}
        {r.shares.radd && <span>· فيها رد</span>}
        <span>· تصحيح أنصبة الورثة: {dg(r.shares.tashih.toString(), digits)}</span>
        <span>· أسهم صافي التركة: {dg(r.tashihNet.toString(), digits)}</span>
      </div>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "إخفاء الخطوات" : "اشرح الحساب خطوة بخطوة"}
      </button>
      {open && (
        <ol className="steplist">
          {r.steps.map((s, i) => (
            <li key={i}>
              {s.text}
              {s.ruleId && RULES[s.ruleId] && (
                <div className="ref">
                  المرجع: {RULES[s.ruleId].law ?? RULES[s.ruleId].title}
                  {RULES[s.ruleId].shariBasis ? ` — ${RULES[s.ruleId].shariBasis}` : ""}
                </div>
              )}
            </li>
          ))}
          {r.wajiba.applies && (
            <li>
              تفصيل الوصية الواجبة:
              <ul>
                {r.wajiba.roots.map((x) => (
                  <li key={x.id}>
                    {x.name || x.label}: نصيبه الافتراضي <span className="frac">{fmtFrac(x.hypothetical, digits)}</span>
                    {r.wajiba.capApplied && (
                      <>
                        {" "}
                        ← بعد الرد إلى الثلث <span className="frac">{fmtFrac(x.capped, digits)}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
