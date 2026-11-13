"use client";
import { summarizeEstate, uid, type CaseInput, type AssetKind } from "@/engine";
import { fmtMoney } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { Card, MoneyInput, Seg } from "../ui";
import { ASSET_KINDS, type Update } from "./shared";

const OWN = ["1", "1/2", "1/3", "1/4", "1/6", "1/8"];

export function EstateFlow({ c }: { c: CaseInput }) {
  const { digits } = useSettings();
  const s = summarizeEstate(c.estate);
  if (c.estate.fractionOnly) return <p className="muted">وضع الكسور فقط: لن تُحسب قيم مالية.</p>;
  return (
    <div className="flow" aria-label="مسار التركة">
      <div className="box">
        <div className="k">إجمالي ممتلكات المتوفى (حصته فقط)</div>
        <div className="v">{fmtMoney(s.totalEstate, digits)}</div>
      </div>
      <div className="box minus">
        <div className="k">تجهيز ودفن</div>
        <div className="v">{fmtMoney(s.funeral, digits)}</div>
      </div>
      <div className="box minus">
        <div className="k">ديون ثابتة عليه</div>
        <div className="v">{fmtMoney(s.debtsProven, digits)}</div>
      </div>
      <div className="box final">
        <div className="k">الصافي قبل الوصايا</div>
        <div className="v">{fmtMoney(s.netBeforeWills > 0n ? s.netBeforeWills : 0n, digits)}</div>
      </div>
    </div>
  );
}

export default function Step2Estate({ c, update }: { c: CaseInput; update: Update }) {
  const e = c.estate;
  const { digits } = useSettings();
  const s = summarizeEstate(e);
  return (
    <>
      <Card title="التركة والالتزامات" icon="②">
        <div className="qrow">
          <div className="q">
            طريقة الحساب
            <small>يمكنك معرفة الأنصبة كسورًا فقط دون إدخال أي قيمة مالية.</small>
          </div>
          <Seg
            label="طريقة الحساب"
            value={e.fractionOnly ? "f" : "m"}
            options={[
              { v: "m", t: "بالقيم المالية" },
              { v: "f", t: "الكسور فقط" },
            ]}
            onChange={(v) => update((x) => void (x.estate.fractionOnly = v === "f"))}
          />
        </div>
      </Card>

      {!e.fractionOnly && (
        <>
          <Card
            title="ممتلكات المتوفى"
            icon="🏛"
            actions={
              <button
                className="btn secondary sm"
                onClick={() => update((x) => void x.estate.assets.push({ id: uid("a"), kind: "cash", label: "", valuePiasters: "0", ownership: "1" }))}
              >
                + إضافة أصل
              </button>
            }
          >
            <p className="small muted">أدخل القيمة الكاملة للأصل ونسبة ملكية المتوفى فيه؛ يُحتسب نصيبه فقط من الممتلكات المشتركة.</p>
            {e.assets.length === 0 && <p className="muted">لم تُضف أصول بعد.</p>}
            <div className="grid">
              {e.assets.map((a, i) => (
                <div key={a.id} className="dnode">
                  <div className="grid three">
                    <label className="field">
                      <span>النوع</span>
                      <select value={a.kind} onChange={(ev) => update((x) => void (x.estate.assets[i].kind = ev.target.value as AssetKind))}>
                        {ASSET_KINDS.map((k) => (
                          <option key={k.v} value={k.v}>
                            {k.t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>الوصف</span>
                      <input value={a.label} placeholder="مثال: شقة مدينة نصر" onChange={(ev) => update((x) => void (x.estate.assets[i].label = ev.target.value))} />
                    </label>
                    <MoneyInput label="القيمة الكاملة" value={a.valuePiasters} onChange={(p) => update((x) => void (x.estate.assets[i].valuePiasters = p))} />
                    <label className="field">
                      <span>حصة المتوفى في ملكيته</span>
                      <select
                        value={OWN.includes(a.ownership) ? a.ownership : "custom"}
                        onChange={(ev) => update((x) => void (x.estate.assets[i].ownership = ev.target.value === "custom" ? "1/5" : ev.target.value))}
                      >
                        {OWN.map((o) => (
                          <option key={o} value={o}>
                            {o === "1" ? "كاملة (1)" : o}
                          </option>
                        ))}
                        <option value="custom">نسبة أخرى…</option>
                      </select>
                      {!OWN.includes(a.ownership) && (
                        <input className="ltr" value={a.ownership} onChange={(ev) => update((x) => void (x.estate.assets[i].ownership = ev.target.value.replace(/\s/g, "")))} placeholder="مثل 3/10" />
                      )}
                    </label>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className="small muted">يدخل في التركة: {fmtMoney(s.assetLines[i]?.included, digits)}</span>
                    <span className="spacer" />
                    <button className="btn danger sm" onClick={() => update((x) => void x.estate.assets.splice(i, 1))}>
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="ديون مستحقة للمتوفى على الغير"
            icon="↩"
            actions={
              <button className="btn secondary sm" onClick={() => update((x) => void x.estate.receivables.push({ id: uid("r"), label: "", amountPiasters: "0", status: "proven_collectible" }))}>
                + إضافة
              </button>
            }
          >
            <p className="small muted">تدخل في الحساب فقط إذا كانت ثابتة وقابلة للتحصيل؛ غيرها يُعرض منفصلًا ويوزع بالنسب نفسها عند تحصيله.</p>
            <div className="grid">
              {e.receivables.map((r, i) => (
                <div key={r.id} className="dnode grid three">
                  <label className="field">
                    <span>الوصف</span>
                    <input value={r.label} onChange={(ev) => update((x) => void (x.estate.receivables[i].label = ev.target.value))} />
                  </label>
                  <MoneyInput label="المبلغ" value={r.amountPiasters} onChange={(p) => update((x) => void (x.estate.receivables[i].amountPiasters = p))} />
                  <label className="field">
                    <span>الحالة</span>
                    <select value={r.status} onChange={(ev) => update((x) => void (x.estate.receivables[i].status = ev.target.value as "proven_collectible" | "doubtful"))}>
                      <option value="proven_collectible">ثابت وقابل للتحصيل</option>
                      <option value="doubtful">غير ثابت أو مشكوك في تحصيله</option>
                    </select>
                    <button className="btn danger sm" onClick={() => update((x) => void x.estate.receivables.splice(i, 1))}>
                      حذف
                    </button>
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="الالتزامات على التركة"
            icon="−"
            actions={
              <button className="btn secondary sm" onClick={() => update((x) => void x.estate.debts.push({ id: uid("d"), kind: "debt", label: "", amountPiasters: "0", proven: true }))}>
                + إضافة التزام
              </button>
            }
          >
            <MoneyInput
              label="مصروفات التجهيز والدفن المعتبرة"
              value={e.funeralPiasters}
              onChange={(p) => update((x) => void (x.estate.funeralPiasters = p))}
              hint="بالقدر المعروف دون إسراف، إن دُفعت من التركة."
            />
            <div className="grid" style={{ marginTop: 12 }}>
              {e.debts.map((d, i) => (
                <div key={d.id} className="dnode">
                  <div className="grid three">
                    <label className="field">
                      <span>النوع</span>
                      <select value={d.kind} onChange={(ev) => update((x) => void (x.estate.debts[i].kind = ev.target.value as "debt" | "deferred_mahr" | "other"))}>
                        <option value="debt">دين على المتوفى</option>
                        <option value="deferred_mahr">مؤخر صداق</option>
                        <option value="other">التزام آخر ثابت</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>الوصف / الدائن</span>
                      <input value={d.label} onChange={(ev) => update((x) => void (x.estate.debts[i].label = ev.target.value))} />
                    </label>
                    <MoneyInput label="المبلغ" value={d.amountPiasters} onChange={(p) => update((x) => void (x.estate.debts[i].amountPiasters = p))} />
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={d.proven} onChange={(ev) => update((x) => void (x.estate.debts[i].proven = ev.target.checked))} />
                    <span>
                      ثابت ومستحق {d.kind === "deferred_mahr" ? "(مؤخر الصداق ثابت بالعقد ولم يُسدَّد أو يُبرأ منه)" : "(بمستند أو إقرار معتبر)"}
                      <span className="small muted" style={{ display: "block" }}>
                        ما لم يُؤكَّد ثبوته لا يُخصم تلقائيًا، ويظهر تنبيه بأثره.
                      </span>
                    </span>
                  </label>
                  <button className="btn danger sm" onClick={() => update((x) => void x.estate.debts.splice(i, 1))}>
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Card
        title="الوصايا الاختيارية"
        icon="✎"
        actions={
          <button
            className="btn secondary sm"
            onClick={() =>
              update(
                (x) =>
                  void x.estate.wills.push({
                    id: uid("w"),
                    beneficiary: "",
                    beneficiaryIsHeir: false,
                    beneficiaryIsWajibaEntitled: false,
                    mode: x.estate.fractionOnly ? "fraction" : "amount",
                    amountPiasters: "0",
                    fraction: "1/3",
                  }),
              )
            }
          >
            + إضافة وصية
          </button>
        }
      >
        <p className="small muted">
          الوصية الواجبة لأولاد الولد المتوفى قبل المورث تُحسب تلقائيًا من بيانات الفروع في الخطوة التالية؛ لا تُدخلها هنا.
        </p>
        <div className="grid">
          {e.wills.map((w, i) => (
            <div key={w.id} className="dnode">
              <div className="grid three">
                <label className="field">
                  <span>الموصى له</span>
                  <input value={w.beneficiary} onChange={(ev) => update((x) => void (x.estate.wills[i].beneficiary = ev.target.value))} placeholder="شخص أو جهة" />
                </label>
                <label className="field">
                  <span>صيغة الوصية</span>
                  <select value={w.mode} onChange={(ev) => update((x) => void (x.estate.wills[i].mode = ev.target.value as "amount" | "fraction"))}>
                    {!e.fractionOnly && <option value="amount">مبلغ محدد</option>}
                    <option value="fraction">كسر من التركة</option>
                  </select>
                </label>
                {w.mode === "amount" && !e.fractionOnly ? (
                  <MoneyInput label="المبلغ" value={w.amountPiasters ?? "0"} onChange={(p) => update((x) => void (x.estate.wills[i].amountPiasters = p))} />
                ) : (
                  <label className="field">
                    <span>الكسر</span>
                    <input className="ltr" value={w.fraction ?? ""} onChange={(ev) => update((x) => void (x.estate.wills[i].fraction = ev.target.value.replace(/\s/g, "")))} placeholder="1/4" />
                  </label>
                )}
              </div>
              <label className="check">
                <input type="checkbox" checked={w.beneficiaryIsHeir} onChange={(ev) => update((x) => void (x.estate.wills[i].beneficiaryIsHeir = ev.target.checked))} />
                <span>الموصى له من الورثة (تنفذ في حدود الثلث دون إجازة وفق المادة 37 من قانون الوصية)</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={w.beneficiaryIsWajibaEntitled}
                  onChange={(ev) => update((x) => void (x.estate.wills[i].beneficiaryIsWajibaEntitled = ev.target.checked))}
                />
                <span>الموصى له من مستحقي الوصية الواجبة (أحفاد من ولد متوفى)</span>
              </label>
              <button className="btn danger sm" onClick={() => update((x) => void x.estate.wills.splice(i, 1))}>
                حذف
              </button>
            </div>
          ))}
        </div>
        {e.wills.length > 0 && (
          <div className="qrow" style={{ marginTop: 10 }}>
            <div className="q">
              إذا زادت الوصايا على الثلث المتاح، هل أجازها الورثة بعد الوفاة؟
              <small>تُعتبر الإجازة من الوارث البالغ الرشيد العالم بما يجيزه فقط.</small>
            </div>
            <Seg
              label="إجازة الورثة"
              value={e.excessConsent}
              options={[
                { v: "none", t: "لم يجيزوا" },
                { v: "all", t: "أجازها الجميع" },
                { v: "partial", t: "أجازها بعضهم" },
              ]}
              onChange={(v) => update((x) => void (x.estate.excessConsent = v))}
            />
          </div>
        )}
      </Card>

      <Card title="ملخص التركة" icon="Σ">
        <EstateFlow c={c} />
        {!e.fractionOnly && s.insolvent && (
          <div className="alert stop" style={{ marginTop: 12 }}>
            <span className="ic">⛔</span>
            <div>الديون والتجهيز تستغرق التركة؛ لن تظهر أنصبة مالية موجبة.</div>
          </div>
        )}
        {!e.fractionOnly && s.receivablesDoubtful > 0n && <p className="small muted">حقوق محتملة غير محتسبة: {fmtMoney(s.receivablesDoubtful, digits)}</p>}
      </Card>
    </>
  );
}
