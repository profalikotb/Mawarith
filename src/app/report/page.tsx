"use client";
import { useEffect, useMemo, useState } from "react";
import { basisText, evaluateCase, RULES, type CaseInput } from "@/engine";
import { dg, fmtDate, fmtDateTime, fmtFrac, fmtMoney, fmtPct } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { loadDraft } from "@/lib/storage";
import "./report.css";

const ROLE: Record<string, string> = { heir: "وارث", blocked: "محجوب", excluded: "غير وارث", wajiba: "وصية واجبة", will: "موصى له", treasury: "الخزانة العامة" };
const STATUS: Record<string, string> = {
  final: "حساب مكتمل وفق البيانات المدخلة",
  preliminary: "حساب مبدئي — يحتاج مراجعة",
  stopped: "لا يمكن إصدار قسمة نهائية — يحتاج متخصصًا",
  incomplete: "بيانات مؤثرة غير محسومة",
};

export default function ReportPage() {
  const [c, setC] = useState<CaseInput | null>(null);
  const { digits } = useSettings();
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mw:report");
      if (raw) {
        localStorage.removeItem("mw:report");
        setC(JSON.parse(raw).input);
        return;
      }
    } catch {
      /* ignore */
    }
    const d = loadDraft();
    if (d) setC(d.input);
  }, []);
  const ev = useMemo(() => (c ? evaluateCase(c) : null), [c]);
  if (!c || !ev) return <p className="muted" style={{ padding: 40 }}>لا توجد مسألة لعرضها. افتح التقرير من صفحة النتائج.</p>;
  const r = ev.result;
  const money = !c.estate.fractionOnly;
  const showShares = r.status === "final" || r.status === "preliminary";
  const f = c.family;
  const fam: string[] = [];
  if (c.meta.deceasedGender === "male") {
    if (f.wives.state === "yes") fam.push(`الزوجات: ${f.wives.list.length}`);
  } else if (f.husband.state === "yes") fam.push("الزوج");
  if (f.father.state === "yes") fam.push("الأب");
  if (f.mother.state === "yes") fam.push("الأم");

  return (
    <div className="report">
      <div className="no-print toolbar">
        <button className="btn primary" onClick={() => window.print()}>
          طباعة / حفظ PDF
        </button>
        <span className="small muted">اختر «حفظ بتنسيق PDF» ومقاس A4 في نافذة الطباعة. النص يبقى قابلًا للبحث والنسخ.</span>
      </div>
      <header className="rhead">
        <div>
          <div className="rtitle">تقرير حساب المواريث الشرعية</div>
          <div className="rsub">{c.meta.title || "مسألة بدون اسم"}</div>
        </div>
        <div className="rmeta">
          <div>تاريخ الحساب: {fmtDateTime(r.computedAt, digits)}</div>
          <div>
            المحرك {r.engineVersion} · القواعد {r.rulesetVersion}
          </div>
        </div>
      </header>
      <div className={`rstatus ${r.status}`}>
        <b>الحالة:</b> {STATUS[r.status]}
      </div>
      <p className="rdisc">نتيجة حسابية مبنية على البيانات المدخلة؛ لا تُعد إعلام وراثة أو حكمًا قضائيًا أو فتوى شخصية معتمدة.</p>

      <h2>١. البيانات والافتراضات</h2>
      <table className="rt">
        <tbody>
          <tr>
            <th>المتوفى</th>
            <td>
              {c.meta.deceasedName || "—"} ({c.meta.deceasedGender === "male" ? "ذكر" : "أنثى"})، {c.meta.deceasedGender === "male" ? "مسلم" : "مسلمة"}
            </td>
            <th>تاريخ الوفاة</th>
            <td>{fmtDate(c.meta.deathDate, digits)}</td>
          </tr>
          <tr>
            <th>الإطار</th>
            <td colSpan={3}>الحساب وفق الإطار المصري للمسلمين — قانون المواريث 77/1943 وقانون الوصية 71/1946</td>
          </tr>
          <tr>
            <th>طريقة الحساب</th>
            <td colSpan={3}>{money ? "بالقيم المالية (الكسور هي الأصل، والمبالغ مقربة إلى القرش)" : "الكسور فقط"}</td>
          </tr>
          {fam.length > 0 && (
            <tr>
              <th>من الأقارب</th>
              <td colSpan={3}>{fam.join("، ")} — والتفصيل في جدول الاستحقاقات</td>
            </tr>
          )}
        </tbody>
      </table>

      {money && (
        <>
          <h2>٢. ملخص التركة</h2>
          <table className="rt">
            <tbody>
              {r.estate.assetLines.map((a) => (
                <tr key={a.id}>
                  <td>{a.label || a.kind}</td>
                  <td className="n">{fmtMoney(a.included, digits)}</td>
                  <td className="small">{a.ownership !== "1" ? `حصة المتوفى ${dg(a.ownership, digits)} من ${fmtMoney(a.full, digits)}` : ""}</td>
                </tr>
              ))}
              {r.estate.receivablesIncluded > 0n && (
                <tr>
                  <td>ديون مستحقة للمتوفى (ثابتة)</td>
                  <td className="n">{fmtMoney(r.estate.receivablesIncluded, digits)}</td>
                  <td />
                </tr>
              )}
              <tr className="sum">
                <td>إجمالي التركة</td>
                <td className="n">{fmtMoney(r.estate.totalEstate, digits)}</td>
                <td />
              </tr>
              <tr>
                <td>(−) تجهيز ودفن</td>
                <td className="n">{fmtMoney(r.estate.funeral, digits)}</td>
                <td />
              </tr>
              <tr>
                <td>(−) ديون ثابتة</td>
                <td className="n">{fmtMoney(r.estate.debtsProven, digits)}</td>
                <td />
              </tr>
              {r.estate.debtsExcluded.map((d, i) => (
                <tr key={i}>
                  <td>غير مخصوم: {d.label}</td>
                  <td className="n">{fmtMoney(d.amount, digits)}</td>
                  <td className="small">{d.why}</td>
                </tr>
              ))}
              <tr className="sum">
                <td>الصافي قبل الوصايا</td>
                <td className="n">{fmtMoney(r.estate.netBeforeWills > 0n ? r.estate.netBeforeWills : 0n, digits)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </>
      )}

      <h2>{money ? "٣" : "٢"}. الديون والوصايا</h2>
      <ul className="rlist">
        <li>الوصية الواجبة: {r.wajiba.applies ? `${fmtFrac(r.wajiba.total, digits)} من الصافي${r.wajiba.capApplied ? " (رُدت إلى الثلث)" : ""}` : "لا تستحق"}</li>
        <li>الوصايا الاختيارية النافذة: {r.wills.wills.length ? fmtFrac(r.wills.executedTotal, digits) : "لا توجد"}</li>
        <li>نصيب الورثة من الصافي: {fmtFrac(r.pool, digits)}</li>
        {r.estate.insolvent && money && <li>التركة مستغرقة بالديون: لا أنصبة مالية ولا تنفذ الوصايا.</li>}
      </ul>

      {showShares && (
        <>
          <h2>{money ? "٤" : "٣"}. جدول الاستحقاقات</h2>
          <table className="rt shares">
            <thead>
              <tr>
                <th>المستحق</th>
                <th>الصلة</th>
                <th>الحالة</th>
                <th>الأساس والسبب</th>
                <th className="n">النصيب</th>
                <th className="n">النسبة</th>
                <th className="n">الأسهم</th>
                {money && <th className="n">القيمة</th>}
              </tr>
            </thead>
            <tbody>
              {r.persons.map((p) => (
                <tr key={p.id} className={p.shareOfNet.isPos() ? "" : "dim"}>
                  <td>{p.name || p.relation}</td>
                  <td>{p.relation}</td>
                  <td>{ROLE[p.role]}</td>
                  <td className="small">
                    {p.role === "heir" || p.role === "wajiba" || p.role === "will" ? `${basisText(p.basis)}: ` : ""}
                    {p.reason}
                  </td>
                  <td className="n">{fmtFrac(p.shareOfNet, digits)}</td>
                  <td className="n">{p.shareOfNet.isPos() ? fmtPct(p.shareOfNet, digits) : "—"}</td>
                  <td className="n">{p.sahmNet ? dg(p.sahmNet.toString(), digits) : "—"}</td>
                  {money && <td className="n">{fmtMoney(p.amount, digits)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>المجموع — {r.balanceOk ? "متزن" : "غير متزن"}</td>
                <td className="n">{fmtFrac(r.persons.reduce((a, p) => a.add(p.shareOfNet), r.pool.sub(r.pool)), digits)}</td>
                <td />
                <td className="n">{dg(r.tashihNet.toString(), digits)}</td>
                {money && <td className="n">{fmtMoney(r.persons.reduce((s, p) => s + (p.amount ?? 0n), 0n), digits)}</td>}
              </tr>
            </tfoot>
          </table>
          <p className="small">
            أصل المسألة {dg(r.shares.base.toString(), digits)}
            {r.shares.awlTo ? ` وعالت إلى ${dg(r.shares.awlTo.toString(), digits)}` : ""}
            {r.shares.radd ? "، وفيها رد" : ""}. سياسة التقريب: كسور دقيقة ثم قروش بطريقة أكبر الباقي، ومجموع المبالغ يساوي الصافي تمامًا.
          </p>
        </>
      )}

      <h2>{showShares ? (money ? "٥" : "٤") : money ? "٤" : "٣"}. خطوات الحساب ومراجعه</h2>
      <ol className="rsteps">
        {r.steps.map((s, i) => (
          <li key={i}>
            {s.text}
            {s.ruleId && RULES[s.ruleId] && <span className="ref"> — {RULES[s.ruleId].law ?? RULES[s.ruleId].title}</span>}
          </li>
        ))}
      </ol>

      <h2>الحالات غير المحسومة والملاحظات</h2>
      {r.issues.length === 0 && r.unknowns.length === 0 ? (
        <p>لا توجد.</p>
      ) : (
        <ul className="rlist">
          {r.unknowns.map((u) => (
            <li key={u.id}>غير محسوم: {u.question}</li>
          ))}
          {r.issues.map((i, k) => (
            <li key={k}>
              [{i.severity === "stop" ? "يوقف" : i.severity === "review" ? "مراجعة" : "ملاحظة"}] {i.message}
              {i.needed ? ` المطلوب: ${i.needed}` : ""}
            </li>
          ))}
        </ul>
      )}
      <footer className="rfoot">
        حساب المواريث الشرعية — أداة حسابية غير معتمدة من جهة رسمية. القواعد مطابقة لنصوص القانونين المنشورة وبانتظار مراجعة متخصص في الفرائض ومحامٍ مصري.
      </footer>
    </div>
  );
}
