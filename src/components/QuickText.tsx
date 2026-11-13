"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { emptyCase, parseCaseText, uid, type CaseInput, type Group, type ParsedSuggestion, type SuggestKey } from "@/engine";
import { saveDraft } from "@/lib/storage";
import { GROUP_KEY_TO_FIELD } from "./wizard/shared";

function buildCase(p: ParsedSuggestion): CaseInput {
  const c = emptyCase();
  c.meta.deceasedGender = p.deceasedGender ?? "male";
  const has = (k: SuggestKey) => p.items.find((i) => i.key === k);
  if (c.meta.deceasedGender === "male") c.family.husband.state = "no";
  else c.family.wives.state = "no";
  for (const it of p.items) {
    switch (it.key) {
      case "husband":
        c.family.husband.state = "yes";
        break;
      case "wives":
        c.family.wives.state = "yes";
        c.family.wives.list = Array.from({ length: Math.min(4, it.count) }, () => ({ id: uid("w"), status: "married" as const }));
        break;
      case "father":
        c.family.father.state = "yes";
        break;
      case "mother":
        c.family.mother.state = "yes";
        break;
      case "gf":
        c.family.paternalGrandfather.state = "yes";
        break;
      case "gm_mm":
        c.family.gm.mm = "yes";
        break;
      case "gm_fm":
        c.family.gm.fm = "yes";
        break;
      case "sons":
      case "daughters":
        for (let i = 0; i < it.count; i++) c.family.children.push({ id: uid("d"), gender: it.key === "sons" ? "male" : "female", status: "alive", children: [] });
        break;
      case "sonsSons":
      case "sonsDaughters": {
        // represented under a predeceased son placeholder that the user must confirm
        let ps = c.family.children.find((d) => d.gender === "male" && d.status === "predeceased" && d.name === "ابن متوفى (للتأكيد)");
        if (!ps) {
          ps = { id: uid("d"), name: "ابن متوفى (للتأكيد)", gender: "male", status: "predeceased", children: [] };
          c.family.children.push(ps);
        }
        for (let i = 0; i < it.count; i++) ps.children.push({ id: uid("d"), gender: it.key === "sonsSons" ? "male" : "female", status: "alive", children: [] });
        break;
      }
      default: {
        const f = GROUP_KEY_TO_FIELD[it.key];
        if (f) (c.family[f] as Group) = { state: "yes", count: it.count, names: [] };
      }
    }
  }
  if (has("husband") || has("wives")) {
    /* spouse stated */
  } else if (c.meta.deceasedGender === "male") c.family.wives.state = "unknown";
  else c.family.husband.state = "unknown";
  return c;
}

export default function QuickText() {
  const [text, setText] = useState("");
  const [p, setP] = useState<ParsedSuggestion | null>(null);
  const router = useRouter();
  return (
    <div className="card">
      <h2>
        <span aria-hidden>✍</span> إدخال نصي سريع (اختياري)
      </h2>
      <p className="small muted">
        اكتب وصفًا مثل: «توفي رجل عن زوجة وابنين وبنت وأم». يستخرج التطبيق بيانات <b style={{ display: "inline" }}>مقترحة</b> بقواعد ثابتة (بلا ذكاء اصطناعي)، ويجب أن تؤكدها وتراجعها قبل الحساب.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="توفي رجل عن زوجة وابنين وبنت وأم" aria-label="وصف المسألة" />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn secondary" disabled={!text.trim()} onClick={() => setP(parseCaseText(text))}>
          استخراج البيانات المقترحة
        </button>
      </div>
      {p && (
        <div style={{ marginTop: 14 }}>
          <p>
            <b style={{ display: "inline" }}>المتوفى:</b> {p.deceasedGender === "female" ? "أنثى" : p.deceasedGender === "male" ? "ذكر" : "غير محدد (افتراضيًا ذكر — صححه في الخطوة الأولى)"}
          </p>
          {p.items.length > 0 ? (
            <ul>
              {p.items.map((i, k) => (
                <li key={k}>
                  {i.label}: {i.count}
                  {i.countUncertain && <span className="small" style={{ color: "var(--warn)" }}> (العدد غير محدد في النص — عدّله)</span>}
                  <span className="small muted"> ← «{i.matched}»</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">لم يُتعرف على أقارب.</p>
          )}
          {p.unrecognized.length > 0 && (
            <div className="alert review">
              <span className="ic">⚠</span>
              <div>
                لم يُفهم: {p.unrecognized.join("، ")}. أدخله يدويًا في خطوة الأقارب.
              </div>
            </div>
          )}
          {p.items.some((i) => i.key === "sonsSons" || i.key === "sonsDaughters") && (
            <p className="small" style={{ color: "var(--warn)" }}>
              أولاد الابن وُضعوا تحت «ابن متوفى (للتأكيد)»؛ عدّل ذلك بحسب الواقع.
            </p>
          )}
          <button
            className="btn primary"
            onClick={() => {
              saveDraft({ caseId: null, step: 0, input: buildCase(p) });
              router.push("/calc");
            }}
          >
            اعتماد المقترح ومتابعة المراجعة
          </button>
        </div>
      )}
    </div>
  );
}
