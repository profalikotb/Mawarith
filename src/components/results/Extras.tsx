"use client";
import { useMemo, useState } from "react";
import { applyTakharuj, evaluateCase, Fraction, pregnancyScenarios, type CaseInput, type CaseResult, type Group, type Tri } from "@/engine";
import { fmtFrac, fmtMoney } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { personTitle } from "./ResultsTable";
import type { GroupField } from "../wizard/shared";

/* --------------------------- scenario comparison -------------------------- */
export function ScenarioTable({ scenarios }: { scenarios: { label: string; result: CaseResult }[] }) {
  const { digits } = useSettings();
  const ids = [...new Map(scenarios.flatMap((s) => s.result.persons.filter((p) => p.shareOfNet.isPos()).map((p) => [p.id, p]))).values()];
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>المستحق</th>
            {scenarios.map((s, i) => (
              <th key={i} style={{ whiteSpace: "normal", minWidth: 150 }}>
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((p) => (
            <tr key={p.id}>
              <td>{personTitle(p)}</td>
              {scenarios.map((s, i) => {
                const x = s.result.persons.find((q) => q.id === p.id);
                return (
                  <td key={i} className="n">
                    {x && x.shareOfNet.isPos() ? <span className="frac">{fmtFrac(x.shareOfNet, digits)}</span> : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td className="small muted">حالة الحساب</td>
            {scenarios.map((s, i) => (
              <td key={i} className="small">
                {s.result.status === "stopped" ? "متوقف" : s.result.status === "preliminary" ? "مبدئي" : s.result.status === "incomplete" ? "ناقص" : "مكتمل"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------- what-if -------------------------------- */
const WHATIF: { id: string; t: string; get: (c: CaseInput) => Tri; set: (c: CaseInput, v: Tri) => void }[] = [
  { id: "father", t: "الأب", get: (c) => c.family.father.state, set: (c, v) => void (c.family.father.state = v) },
  { id: "mother", t: "الأم", get: (c) => c.family.mother.state, set: (c, v) => void (c.family.mother.state = v) },
  { id: "husband", t: "الزوج", get: (c) => c.family.husband.state, set: (c, v) => void (c.family.husband.state = v) },
  {
    id: "wives",
    t: "زوجة",
    get: (c) => c.family.wives.state,
    set: (c, v) => {
      c.family.wives.state = v;
      if (v === "yes" && !c.family.wives.list.length) c.family.wives.list.push({ id: "w_whatif", status: "married" });
    },
  },
  ...(
    [
      ["fullBrothers", "أخ شقيق"],
      ["fullSisters", "أخت شقيقة"],
      ["patBrothers", "أخ لأب"],
      ["patSisters", "أخت لأب"],
      ["matBrothers", "أخ لأم"],
      ["matSisters", "أخت لأم"],
      ["fullUncles", "عم شقيق"],
    ] as [GroupField, string][]
  ).map(([k, t]) => ({
    id: k,
    t,
    get: (c: CaseInput) => (c.family[k] as Group).state,
    set: (c: CaseInput, v: Tri) => void ((c.family[k] as Group).state = v),
  })),
];

export function WhatIf({ c, base }: { c: CaseInput; base: CaseResult }) {
  const [sel, setSel] = useState<string>("");
  const opt = WHATIF.find((w) => w.id === sel);
  const relevant = WHATIF.filter((w) => !(w.id === "husband" && c.meta.deceasedGender === "male") && !(w.id === "wives" && c.meta.deceasedGender === "female"));
  const alt = useMemo(() => {
    if (!opt) return null;
    const x: CaseInput = JSON.parse(JSON.stringify(c));
    const cur = opt.get(c);
    opt.set(x, cur === "yes" ? "no" : "yes");
    return { label: `لو ${cur === "yes" ? "لم يوجد" : "وُجد"} ${opt.t}`, result: evaluateCase(x).result };
  }, [opt, c]);
  return (
    <div>
      <p className="small muted">افترض تغيير معلومة واحدة لترى أثرها. السيناريو الافتراضي منفصل تمامًا عن المسألة الأصلية ولا يغيّرها.</p>
      <label className="field" style={{ maxWidth: 360 }}>
        <span>المعلومة المراد تغييرها</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">— اختر —</option>
          {relevant.map((w) => (
            <option key={w.id} value={w.id}>
              {w.get(c) === "yes" ? `لو لم يوجد ${w.t}` : `لو وُجد ${w.t}`}
            </option>
          ))}
        </select>
      </label>
      {alt && (
        <div style={{ marginTop: 12 }}>
          <ScenarioTable scenarios={[{ label: "المسألة الأصلية", result: base }, alt]} />
        </div>
      )}
    </div>
  );
}

/* --------------------------------- pregnancy ------------------------------ */
export function PregnancyPanel({ c }: { c: CaseInput }) {
  const { digits } = useSettings();
  const pv = useMemo(() => pregnancyScenarios(c), [c]);
  return (
    <div>
      <p className="small">يوقف للحمل أوفر النصيبين، ويُعطى كل مستحق الآن أقل نصيبيه (المادة 42). يُعاد الحساب بعد الولادة.</p>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>المستحق</th>
              <th className="n">إن كان الحمل ذكرًا</th>
              <th className="n">إن كان أنثى</th>
              <th className="n">يُعطى الآن</th>
            </tr>
          </thead>
          <tbody>
            {pv.rows
              .filter((r) => r.ifMale.isPos() || r.ifFemale.isPos())
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="n">{fmtFrac(r.ifMale, digits)}</td>
                  <td className="n">{fmtFrac(r.ifFemale, digits)}</td>
                  <td className="n">
                    <span className="frac">{fmtFrac(r.immediate, digits)}</span>
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td>الموقوف للحمل حتى الولادة</td>
              <td colSpan={2} />
              <td className="n">
                <span className="frac">{fmtFrac(pv.reserved, digits)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- real estate ---------------------------- */
export function RealEstatePanel({ c, r }: { c: CaseInput; r: CaseResult }) {
  const { digits } = useSettings();
  const props = r.estate.assetLines.filter((a) => a.kind === "realestate" || a.kind === "land");
  if (!props.length || c.estate.fractionOnly) return <p className="muted small">لا توجد عقارات أو أراضٍ مدخلة.</p>;
  const heirs = r.persons.filter((p) => p.role === "heir" && p.shareOfPool?.isPos());
  return (
    <div>
      <p className="small muted">
        الحصة الشائعة لكل وارث = نصيبه الشرعي × حصة المتوفى في العقار. القيمة تقديرية على أساس التقييم المدخل، وتفترض سداد الديون والوصايا من باقي التركة؛ وهي ليست قسمة عينية قانونية.
      </p>
      {props.map((a) => (
        <div key={a.id} style={{ marginBottom: 12 }}>
          <h3>
            {a.label || "عقار"} <span className="small muted">(حصة المتوفى {a.ownership})</span>
          </h3>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>الوارث</th>
                  <th className="n">الحصة الشائعة في العقار كله</th>
                  <th className="n">القيمة التقديرية</th>
                </tr>
              </thead>
              <tbody>
                {heirs.map((p) => {
                  const own = Fraction.parse(a.ownership);
                  const share = p.shareOfPool!.mul(own);
                  const val = p.shareOfPool!.mul(new Fraction(a.included));
                  return (
                    <tr key={p.id}>
                      <td>{personTitle(p)}</td>
                      <td className="n">
                        <span className="frac">{fmtFrac(share, digits)}</span>
                      </td>
                      <td className="n">{fmtMoney(val.n / val.d, digits)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- takharuj ------------------------------- */
export function TakharujPanel({ r, minors }: { r: CaseResult; minors: boolean }) {
  const { digits } = useSettings();
  const heirs = r.persons.filter((p) => p.role === "heir" && p.shareOfPool?.isPos()).map((p) => ({ id: p.id, label: personTitle(p), share: p.shareOfPool! }));
  const [ex, setEx] = useState("");
  const [mode, setMode] = useState<"with_one" | "with_all_from_estate" | "with_all_own_money">("with_all_from_estate");
  const [withId, setWithId] = useState("");
  const [agreed, setAgreed] = useState(false);
  if (heirs.length < 2) return <p className="muted small">يحتاج التخارج إلى وارثين على الأقل.</p>;
  const res = ex && agreed ? applyTakharuj({ heirs, exitingId: ex, mode, withId, minorsInvolved: minors }) : null;
  return (
    <div>
      <p className="small muted">وحدة اختيارية منفصلة عن أصل الاستحقاق. لا تُطبق إلا بعد اتفاق مكتوب ومسجل، والتحقق من أهلية الأطراف وحقوق القُصّر.</p>
      <div className="grid three">
        <label className="field">
          <span>الوارث الخارج</span>
          <select value={ex} onChange={(e) => setEx(e.target.value)}>
            <option value="">— اختر —</option>
            {heirs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>صورة التخارج</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="with_all_from_estate">مع باقي الورثة — المقابل من التركة</option>
            <option value="with_all_own_money">مع باقي الورثة — المقابل من مالهم</option>
            <option value="with_one">مع وارث واحد</option>
          </select>
        </label>
        {mode === "with_one" && (
          <label className="field">
            <span>الوارث المتخارَج معه</span>
            <select value={withId} onChange={(e) => setWithId(e.target.value)}>
              <option value="">— اختر —</option>
              {heirs
                .filter((h) => h.id !== ex)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>يوجد اتفاق تخارج مكتوب، وتحققت أهلية أطرافه{minors ? "، وصدر إذن الجهة المختصة لوجود قاصر" : ""}.</span>
      </label>
      {res && res.ok && (
        <>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>الوارث</th>
                  <th className="n">قبل التخارج</th>
                  <th className="n">بعد التخارج</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((x) => (
                  <tr key={x.id}>
                    <td>{x.label}</td>
                    <td className="n">{fmtFrac(x.before, digits)}</td>
                    <td className="n">
                      <span className="frac">{fmtFrac(x.after, digits)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="small">
            {res.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}
      {res && !res.ok && <p className="small" style={{ color: "var(--danger)" }}>{res.notes.join(" ")}</p>}
    </div>
  );
}

/* --------------------------------- documents ------------------------------ */
export function DocumentsChecklist({ c, r }: { c: CaseInput; r: CaseResult }) {
  const items = [
    "شهادة وفاة المورث.",
    "إعلام الوراثة (يصدر من محكمة الأسرة) — هو المستند الرسمي لتحديد الورثة.",
    "قسائم الزواج للزوج/الزوجات، ووثائق الطلاق إن وجدت.",
    "شهادات ميلاد الأبناء والأحفاد، وشهادات وفاة من توفي قبل المورث.",
    ...(r.wajiba.applies ? ["ما يثبت وفاة الأصل قبل المورث وتسلسل نسب المستحقين للوصية الواجبة."] : []),
    ...(c.estate.assets.some((a) => a.kind === "realestate" || a.kind === "land") ? ["مستندات ملكية العقارات والأراضي (عقود مسجلة أو أحكام صحة ونفاذ)."] : []),
    ...(c.estate.assets.some((a) => a.kind === "bank") ? ["كشوف الحسابات البنكية وشهادات الإيداع في تاريخ الوفاة."] : []),
    ...(c.estate.debts.length ? ["سندات الديون وما يثبت مؤخر الصداق، وما يثبت السداد أو الإبراء."] : []),
    ...(c.estate.wills.length ? ["أصل الوصية وما يثبت إجازة الورثة إن وجدت."] : []),
    ...(c.flags.minors === "yes" ? ["قرار الولاية أو الوصاية على القاصر، وإذن النيابة/المحكمة للتصرفات اللازمة."] : []),
  ];
  return (
    <div>
      <p className="small muted">قائمة مساعدة للمراجعة فقط، وليست قائمة رسمية شاملة؛ قد تطلب الجهات المختصة مستندات أخرى.</p>
      <ul>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
