"use client";
import type { CaseInput } from "@/engine";
import { Card, DateInput, Seg, TriToggle } from "../ui";
import type { Update } from "./shared";

export default function Step1Meta({ c, update }: { c: CaseInput; update: Update }) {
  return (
    <>
      <Card title="بيانات المسألة" icon="①">
        <div className="grid two">
          <label className="field">
            <span>
              اسم المسألة <span className="hint">(اختياري — للتمييز عند الحفظ)</span>
            </span>
            <input value={c.meta.title ?? ""} onChange={(e) => update((x) => void (x.meta.title = e.target.value))} placeholder="مثال: تركة الوالد" />
          </label>
          <label className="field">
            <span>
              اسم المتوفى <span className="hint">(اختياري)</span>
            </span>
            <input value={c.meta.deceasedName ?? ""} onChange={(e) => update((x) => void (x.meta.deceasedName = e.target.value))} />
          </label>
        </div>
        <hr className="sep" />
        <div className="qrow">
          <div className="q">
            جنس المتوفى
            <small>يحدد الأسئلة اللاحقة (زوج أم زوجات).</small>
          </div>
          <Seg
            label="جنس المتوفى"
            value={c.meta.deceasedGender}
            options={[
              { v: "male", t: "ذكر" },
              { v: "female", t: "أنثى" },
            ]}
            onChange={(v) =>
              update((x) => {
                x.meta.deceasedGender = v;
                if (v === "male") x.family.husband.state = "no";
                else {
                  x.family.wives.state = "no";
                  x.family.wives.list = [];
                }
                if (v === "male" && x.family.wives.state === "no") x.family.wives.state = "unknown";
                if (v === "female" && x.family.husband.state === "no") x.family.husband.state = "unknown";
              })
            }
          />
        </div>
        <div className="grid two" style={{ marginTop: 12 }}>
          <DateInput
            label="تاريخ الوفاة"
            value={c.meta.deathDate}
            onChange={(iso) => update((x) => void (x.meta.deathDate = iso))}
            hint="يُستخدم لكشف تعارض التواريخ ولتحديد من كان حيًا وقت الوفاة."
          />
          <label className="field">
            <span>الإطار القانوني المعتمد</span>
            <select value={c.meta.framework} onChange={() => {}} aria-describedby="fw-hint">
              <option value="EG">الحساب وفق الإطار المصري للمسلمين (ق 77/1943 وق 71/1946)</option>
            </select>
            <span className="hint" id="fw-hint">
              المقارنة الفقهية بين المذاهب غير مفعّلة في هذا الإصدار، ولن تُخلط بالنتيجة المصرية عند إضافتها.
            </span>
          </label>
        </div>
        <hr className="sep" />
        <label className="check">
          <input type="checkbox" checked={c.meta.confirmDeceased} onChange={(e) => update((x) => void (x.meta.confirmDeceased = e.target.checked))} />
          <span>
            أؤكد أن المسألة لتركة شخص متوفى (أو صدر حكم باعتباره ميتًا).
            <span className="small muted" style={{ display: "block" }}>
              لا يحسب التطبيق تقسيم أموال شخص حي.
            </span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={c.meta.deceasedIsMuslim} onChange={(e) => update((x) => void (x.meta.deceasedIsMuslim = e.target.checked))} />
          <span>المتوفى مسلم (يقتصر هذا الإطار على تركات المسلمين).</span>
        </label>
      </Card>
      <Card title="سؤال سريع" icon="؟">
        <div className="qrow">
          <div className="q">
            هل يوجد نزاع بين الورثة أو معلومات غير مؤكدة؟
            <small>مثل الشك في زواج أو نسب أو وصية. يجعل النتيجة مبدئية ولا يمنع الحساب.</small>
          </div>
          <TriToggle label="وجود نزاع" labels={["نعم", "لا", "لا أعلم"]} value={c.flags.generalDispute} onChange={(v) => update((x) => void (x.flags.generalDispute = v))} />
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          لا يطلب التطبيق الرقم القومي أو العنوان أو أي بيانات شخصية غير لازمة للحساب. الأسماء كلها اختيارية.
        </p>
      </Card>
    </>
  );
}
