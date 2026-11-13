"use client";
import { useState } from "react";
import type { CaseInput, Evaluation } from "@/engine";
import { fmtFrac, fmtMoney } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { exportExcel } from "@/lib/excel";
import { Card, IssueList } from "../ui";
import { EstateFlow } from "../wizard/Step2Estate";
import Explanation from "./Explanation";
import { DocumentsChecklist, PregnancyPanel, RealEstatePanel, ScenarioTable, TakharujPanel, WhatIf } from "./Extras";
import ResultsTable from "./ResultsTable";
import ShareChart from "./ShareChart";

const STATUS = {
  final: { ic: "✓", t: "حساب مكتمل وفق البيانات المدخلة", d: "لا توجد معلومات ناقصة مؤثرة ولا حالات تستدعي التوقف." },
  preliminary: { ic: "⚠", t: "حساب مبدئي", d: "توجد حالات تحتاج إلى مراجعة؛ الأنصبة معروضة بشرط صحة الافتراضات المبينة." },
  stopped: { ic: "⛔", t: "لا يمكن إصدار قسمة نهائية", d: "المسألة تتضمن حالة غير مدعومة أو تحتاج إلى مختص. الأسباب والمطلوب مبينة أدناه." },
  incomplete: { ic: "؟", t: "بيانات مؤثرة غير محسومة", d: "النتيجة تتغير بحسب معلومات لم تُحسم بعد؛ انظر مقارنة الاحتمالات." },
};

export function openReport(c: CaseInput) {
  try {
    localStorage.setItem("mw:report", JSON.stringify({ at: Date.now(), input: c }));
  } catch {
    /* ignore */
  }
  window.open("/report", "_blank");
}

export function downloadJSON(c: CaseInput) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `مسألة-${(c.meta.title || "مواريث").replace(/[\\/:*?"<>|]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export default function Results({ c, ev, onSave, goTo }: { c: CaseInput; ev: Evaluation; onSave: () => void; goTo: (s: number) => void }) {
  const { digits } = useSettings();
  const r = ev.result;
  const [tab, setTab] = useState<"table" | "chart">("table");
  const [busy, setBusy] = useState(false);
  const st = STATUS[r.status];
  const showMoney = !c.estate.fractionOnly && !r.estate.insolvent;
  const showShares = r.status === "final" || r.status === "preliminary";

  return (
    <>
      <div className={`status ${r.status}`} role="status">
        <span style={{ fontSize: "1.8rem" }} aria-hidden>
          {st.ic}
        </span>
        <div>
          <div className="big">{st.t}</div>
          <div className="small">{st.d}</div>
        </div>
      </div>

      <IssueList issues={r.issues} filter={["stop", "review"]} />

      {r.status === "incomplete" && (
        <Card title="مقارنة الاحتمالات" icon="⇄">
          <p>
            المعلومات غير المحسومة: <b style={{ display: "inline" }}>{ev.material.map((u) => u.label).join("، ")}</b>. الجدول يبين أثر كل احتمال؛ لا يُعتمد أيٌّ منها قبل حسم المعلومة.
          </p>
          <ScenarioTable scenarios={ev.scenarios} />
          {ev.material.length > 3 && <p className="small muted">عُرضت أول ثلاث معلومات فقط.</p>}
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => goTo(3)}>
            استكمال البيانات
          </button>
        </Card>
      )}

      {showShares && (
        <>
          <Card title="ملخص التركة قبل الميراث" icon="Σ">
            <EstateFlow c={c} />
            {(r.wajiba.applies || r.wills.wills.length > 0) && (
              <div className="flow" style={{ marginTop: 10 }}>
                {r.wajiba.applies && (
                  <div className="box minus">
                    <div className="k">الوصية الواجبة</div>
                    <div className="v">
                      {showMoney ? fmtMoney(r.persons.filter((p) => p.role === "wajiba").reduce((s, p) => s + (p.amount ?? 0n), 0n), digits) : fmtFrac(r.wajiba.total, digits)}
                    </div>
                  </div>
                )}
                {r.wills.wills.length > 0 && (
                  <div className="box minus">
                    <div className="k">الوصايا الاختيارية النافذة</div>
                    <div className="v">
                      {showMoney ? fmtMoney(r.persons.filter((p) => p.role === "will").reduce((s, p) => s + (p.amount ?? 0n), 0n), digits) : fmtFrac(r.wills.executedTotal, digits)}
                    </div>
                  </div>
                )}
                <div className="box final">
                  <div className="k">صافي المال القابل للتوزيع ميراثًا</div>
                  <div className="v">
                    {showMoney
                      ? fmtMoney(r.persons.filter((p) => p.role === "heir" || p.role === "treasury").reduce((s, p) => s + (p.amount ?? 0n), 0n), digits)
                      : fmtFrac(r.pool, digits)}
                  </div>
                </div>
              </div>
            )}
            {r.estate.insolvent && !c.estate.fractionOnly && (
              <p style={{ marginTop: 10 }}>
                <b>التركة مستغرقة بالديون:</b> لا أنصبة مالية للورثة ولا تنفذ الوصايا. الكسور أدناه للبيان فقط إذا بقي شيء بعد السداد أو الإبراء.
              </p>
            )}
          </Card>

          <Card
            title="الاستحقاقات"
            icon="⚖"
            actions={
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={tab === "table"} onClick={() => setTab("table")}>
                  جدول
                </button>
                <button role="tab" aria-selected={tab === "chart"} onClick={() => setTab("chart")}>
                  مخطط
                </button>
              </div>
            }
          >
            {tab === "table" ? <ResultsTable r={r} showMoney={showMoney} /> : <ShareChart r={r} />}
            {showMoney && <p className="small muted" style={{ marginTop: 8 }}>المبالغ مقربة إلى القرش للعرض بطريقة أكبر الباقي، ومجموعها يساوي صافي التركة تمامًا؛ الكسور هي الأصل.</p>}
          </Card>

          <Card title="الشرح" icon="✎">
            <Explanation r={r} />
          </Card>

          {c.flags.pregnancy === "yes" && c.flags.pregnancyRelation === "decedent_child" && (
            <Card title="الحمل — الموقوف والمعجَّل" icon="◔">
              <PregnancyPanel c={c} />
            </Card>
          )}

          <Card title="أدوات إضافية" icon="⚙">
            <details>
              <summary>
                <b style={{ display: "inline" }}>مقارنة السيناريوهات</b> — ماذا لو تغيرت معلومة؟
              </summary>
              <WhatIf c={c} base={r} />
            </details>
            <hr className="sep" />
            <details>
              <summary>
                <b style={{ display: "inline" }}>حصص العقارات الشائعة</b>
              </summary>
              <RealEstatePanel c={c} r={r} />
            </details>
            <hr className="sep" />
            <details>
              <summary>
                <b style={{ display: "inline" }}>التخارج</b> (اختياري)
              </summary>
              <TakharujPanel r={r} minors={c.flags.minors === "yes"} />
            </details>
            <hr className="sep" />
            <details>
              <summary>
                <b style={{ display: "inline" }}>مستندات مساعدة للمراجعة</b>
              </summary>
              <DocumentsChecklist c={c} r={r} />
            </details>
          </Card>
        </>
      )}

      <IssueList issues={r.issues} filter={["info"]} />

      <Card title="الحفظ والتصدير" icon="⇩">
        <div className="row">
          <button className="btn primary" onClick={onSave}>
            حفظ نسخة من المسألة على هذا الجهاز
          </button>
          <button className="btn secondary" onClick={() => openReport(c)}>
            تقرير PDF للطباعة (A4)
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await exportExcel(c, r);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "جارٍ التصدير…" : "تصدير Excel"}
          </button>
          <button className="btn ghost" onClick={() => downloadJSON(c)}>
            تصدير بيانات المسألة (JSON)
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          إصدار المحرك {r.engineVersion} · إصدار القواعد {r.rulesetVersion}. لا يُرفع شيء إلى الإنترنت عند الحفظ المحلي أو التصدير.
        </p>
      </Card>
    </>
  );
}
