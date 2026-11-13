"use client";
import { relationText, uid, type CaseInput, type Descendant, type Group, type LifeStatus, type Tri } from "@/engine";
import { Card, MoneyInput, NumberInput, TriToggle } from "../ui";
import type { GroupField, Update } from "./shared";

const STATUS: { v: LifeStatus; t: string }[] = [
  { v: "alive", t: "حي وقت وفاة المورث" },
  { v: "predeceased", t: "توفي قبل المورث" },
  { v: "simultaneous", t: "توفي معه / لا يُعلم أيهما مات أولًا" },
  { v: "died_after", t: "توفي بعد المورث" },
  { v: "unknown", t: "غير معلوم" },
];

function GroupEditor({ g, label, help, onChange }: { g: Group; label: string; help?: string; onChange: (g: Group) => void }) {
  return (
    <div className="qrow">
      <div className="q">
        {label}
        <small>{help ?? "على قيد الحياة وقت وفاة المورث"}</small>
      </div>
      <TriToggle label={label} value={g.state} onChange={(state) => onChange({ ...g, state })} />
      {g.state !== "no" && (
        <div className="extra grid two">
          <NumberInput label={g.state === "unknown" ? "العدد المحتمل" : "العدد"} value={g.count || 1} onChange={(count) => onChange({ ...g, count })} />
          <details>
            <summary className="small">أسماء (اختياري)</summary>
            <div className="grid" style={{ marginTop: 6 }}>
              {Array.from({ length: g.count || 1 }).map((_, i) => (
                <input
                  key={i}
                  aria-label={`اسم ${i + 1}`}
                  value={g.names?.[i] ?? ""}
                  placeholder={`الاسم ${i + 1}`}
                  onChange={(e) => {
                    const names = [...(g.names ?? [])];
                    names[i] = e.target.value;
                    onChange({ ...g, names });
                  }}
                />
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SimpleTri({ label, help, value, onChange, name, onName }: { label: string; help?: string; value: Tri; onChange: (v: Tri) => void; name?: string; onName?: (s: string) => void }) {
  return (
    <div className="qrow">
      <div className="q">
        {label}
        <small>{help ?? "على قيد الحياة وقت وفاة المورث"}</small>
      </div>
      <TriToggle label={label} value={value} onChange={onChange} labels={["على قيد الحياة", "متوفى قبله / غير موجود", "غير معلوم"]} />
      {value === "yes" && onName && (
        <div className="extra">
          <input value={name ?? ""} onChange={(e) => onName(e.target.value)} placeholder="الاسم (اختياري)" style={{ maxWidth: 320 }} />
        </div>
      )}
    </div>
  );
}

function DescNode({ d, path, onChange, onRemove, fractionOnly }: { d: Descendant; path: ("male" | "female")[]; onChange: (d: Descendant) => void; onRemove: () => void; fractionOnly: boolean }) {
  const rel = relationText(path);
  const dead = d.status === "predeceased" || d.status === "simultaneous";
  const depth = path.length;
  const addChild = (gender: "male" | "female") =>
    onChange({ ...d, children: [...d.children, { id: uid("d"), gender, status: "alive", children: [] }] });
  return (
    <div className="dnode">
      <div className="head">
        <span className="badge neutral">{rel}</span>
        <input aria-label={`اسم ${rel}`} value={d.name ?? ""} placeholder="الاسم (اختياري)" onChange={(e) => onChange({ ...d, name: e.target.value })} />
        <select aria-label={`حالة ${rel}`} value={d.status} onChange={(e) => onChange({ ...d, status: e.target.value as LifeStatus })}>
          {STATUS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.t}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="btn danger sm" onClick={onRemove} aria-label={`حذف ${rel}`}>
          حذف
        </button>
      </div>
      {d.status === "died_after" && <p className="small muted" style={{ margin: "6px 0 0" }}>يرث من المورث، ثم ينتقل نصيبه إلى ورثته (مناسخة) بحساب مستقل.</p>}
      {dead && depth === 1 && (
        <p className="small" style={{ margin: "6px 0 0", color: "var(--gold)" }}>
          أضف {d.gender === "male" ? "أولاده" : "أولادها"} الأحياء وقت وفاة المورث لبحث استحقاقهم الوصية الواجبة.
        </p>
      )}
      {(d.status === "alive" || d.status === "died_after") && depth >= 2 && !fractionOnly && (
        <details style={{ marginTop: 6 }}>
          <summary className="small">ما أعطاه المورث له بغير عوض (للوصية الواجبة)</summary>
          <MoneyInput label="قيمة الهبة أو العطية" value={d.giftPiasters ?? "0"} onChange={(p) => onChange({ ...d, giftPiasters: p })} />
        </details>
      )}
      {(dead || d.children.length > 0 || d.status === "unknown") && depth < 5 && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn secondary sm" onClick={() => addChild("male")}>
            + ابن {d.gender === "male" ? "له" : "لها"}
          </button>
          <button className="btn secondary sm" onClick={() => addChild("female")}>
            + بنت {d.gender === "male" ? "له" : "لها"}
          </button>
        </div>
      )}
      {d.children.length > 0 && (
        <div className="dchildren">
          {d.children.map((ch, i) => (
            <DescNode
              key={ch.id}
              d={ch}
              path={[...path, ch.gender]}
              fractionOnly={fractionOnly}
              onChange={(nd) => {
                const children = [...d.children];
                children[i] = nd;
                onChange({ ...d, children });
              }}
              onRemove={() => onChange({ ...d, children: d.children.filter((_, k) => k !== i) })}
            />
          ))}
        </div>
      )}
      {(d.status === "alive" || d.status === "died_after") && d.children.length === 0 && depth < 5 && d.gender === "male" && (
        <details style={{ marginTop: 6 }}>
          <summary className="small muted">إضافة أبناء له (لا يؤثرون في الغالب لأن الابن يحجب فروعه)</summary>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn secondary sm" onClick={() => addChild("male")}>
              + ابن
            </button>
            <button className="btn secondary sm" onClick={() => addChild("female")}>
              + بنت
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

export default function Step3Family({ c, update }: { c: CaseInput; update: Update }) {
  const f = c.family;
  const male = c.meta.deceasedGender === "male";
  const setG = (k: GroupField) => (g: Group) => update((x) => void (x.family[k] = g));
  const needOtherAgnates =
    !f.children.some((d) => d.gender === "male" && (d.status === "alive" || d.status === "died_after")) &&
    f.father.state !== "yes" &&
    f.fullBrothers.state !== "yes" &&
    f.patBrothers.state !== "yes";

  return (
    <>
      <Card title="الزوجية" icon="③">
        {male ? (
          <>
            <div className="qrow">
              <div className="q">
                هل كان للمتوفى زوجة أو زوجات وقت وفاته؟
                <small>تشمل المطلقة رجعيًا التي توفي وهي في العدة.</small>
              </div>
              <TriToggle
                label="الزوجات"
                value={f.wives.state}
                onChange={(v) =>
                  update((x) => {
                    x.family.wives.state = v;
                    if (v === "yes" && !x.family.wives.list.length) x.family.wives.list.push({ id: uid("w"), status: "married" });
                  })
                }
              />
            </div>
            {f.wives.state === "yes" && (
              <div className="grid" style={{ marginTop: 10 }}>
                {f.wives.list.map((w, i) => (
                  <div key={w.id} className="dnode head">
                    <span className="badge neutral">الزوجة {i + 1}</span>
                    <input value={w.name ?? ""} placeholder="الاسم (اختياري)" onChange={(e) => update((x) => void (x.family.wives.list[i].name = e.target.value))} />
                    <select value={w.status} onChange={(e) => update((x) => void (x.family.wives.list[i].status = e.target.value as typeof w.status))}>
                      <option value="married">زوجة قائمة الزوجية</option>
                      <option value="raji_idda">مطلقة رجعيًا ومات وهي في العدة</option>
                      <option value="bain_marad">مطلقة بائنًا في مرض موته دون رضاها ومات وهي في العدة</option>
                      <option value="bain">مطلقة بائنًا (لا ترث)</option>
                    </select>
                    <button className="btn danger sm" onClick={() => update((x) => void x.family.wives.list.splice(i, 1))}>
                      حذف
                    </button>
                  </div>
                ))}
                {f.wives.list.length < 4 && (
                  <button className="btn secondary sm" onClick={() => update((x) => void x.family.wives.list.push({ id: uid("w"), status: "married" }))}>
                    + إضافة زوجة
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="qrow">
            <div className="q">
              هل كان للمتوفاة زوج على قيد الحياة وقت وفاتها؟
              <small>يرث المطلِّق رجعيًا إذا ماتت في العدة.</small>
            </div>
            <TriToggle label="الزوج" value={f.husband.state} onChange={(v) => update((x) => void (x.family.husband.state = v))} />
            {f.husband.state === "yes" && (
              <div className="extra row">
                <input value={f.husband.name ?? ""} placeholder="الاسم (اختياري)" style={{ maxWidth: 260 }} onChange={(e) => update((x) => void (x.family.husband.name = e.target.value))} />
                <select value={f.husband.status} style={{ maxWidth: 320 }} onChange={(e) => update((x) => void (x.family.husband.status = e.target.value as typeof f.husband.status))}>
                  <option value="married">زوج قائم الزوجية</option>
                  <option value="raji_idda">طلقها رجعيًا وماتت في العدة</option>
                  <option value="bain">طلاق بائن (لا يرث)</option>
                </select>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="الأصول (الآباء والأجداد)" icon="▲">
        <SimpleTri label="الأب" value={f.father.state} onChange={(v) => update((x) => void (x.family.father.state = v))} name={f.father.name} onName={(s) => update((x) => void (x.family.father.name = s))} />
        <SimpleTri label="الأم" value={f.mother.state} onChange={(v) => update((x) => void (x.family.mother.state = v))} name={f.mother.name} onName={(s) => update((x) => void (x.family.mother.name = s))} />
        {f.father.state !== "yes" && (
          <SimpleTri
            label="الجد أبو الأب"
            help="الجد الصحيح يقوم مقام الأب عند عدمه، مع أحكام خاصة."
            value={f.paternalGrandfather.state}
            onChange={(v) => update((x) => void (x.family.paternalGrandfather.state = v))}
          />
        )}
        {f.mother.state !== "yes" && (
          <>
            <SimpleTri label="الجدة أم الأم" value={f.gm.mm} onChange={(v) => update((x) => void (x.family.gm.mm = v))} />
            {f.father.state !== "yes" && <SimpleTri label="الجدة أم الأب" value={f.gm.fm} onChange={(v) => update((x) => void (x.family.gm.fm = v))} />}
            <details>
              <summary className="small">جدات أبعد درجة (تظهر فقط عند عدم الجدات الأقرب)</summary>
              <SimpleTri label="أم أم الأم" value={f.gm.mmm} onChange={(v) => update((x) => void (x.family.gm.mmm = v))} />
              <SimpleTri label="أم أم الأب" value={f.gm.fmm} onChange={(v) => update((x) => void (x.family.gm.fmm = v))} />
              <SimpleTri label="أم أبي الأب" value={f.gm.ffm} onChange={(v) => update((x) => void (x.family.gm.ffm = v))} />
            </details>
          </>
        )}
      </Card>

      <Card
        title="الفروع (الأبناء والبنات وأولادهم)"
        icon="▼"
        actions={
          <div className="row">
            <button className="btn secondary sm" onClick={() => update((x) => void x.family.children.push({ id: uid("d"), gender: "male", status: "alive", children: [] }))}>
              + ابن
            </button>
            <button className="btn secondary sm" onClick={() => update((x) => void x.family.children.push({ id: uid("d"), gender: "female", status: "alive", children: [] }))}>
              + بنت
            </button>
          </div>
        }
      >
        <p className="small muted">
          أضف كل ابن وبنت للمتوفى، ومنهم من توفي قبله. لمن توفي قبله أضف أولاده الأحياء وقت وفاة المورث؛ يُبحث بها الإرث والوصية الواجبة.
        </p>
        {f.children.length === 0 && <p className="muted">لا يوجد فروع مضافة. إذا لم يكن للمتوفى أولاد فاترك هذا القسم فارغًا.</p>}
        <div className="grid">
          {f.children.map((d, i) => (
            <DescNode
              key={d.id}
              d={d}
              path={[d.gender]}
              fractionOnly={c.estate.fractionOnly}
              onChange={(nd) => update((x) => void (x.family.children[i] = nd))}
              onRemove={() => update((x) => void x.family.children.splice(i, 1))}
            />
          ))}
        </div>
      </Card>

      <Card title="الإخوة والأخوات" icon="↔">
        <p className="small muted">«الشقيق» من الأب والأم، «لأب» من الأب فقط، «لأم» من الأم فقط.</p>
        <GroupEditor label="إخوة أشقاء (ذكور)" g={f.fullBrothers} onChange={setG("fullBrothers")} />
        <GroupEditor label="أخوات شقيقات" g={f.fullSisters} onChange={setG("fullSisters")} />
        <GroupEditor label="إخوة لأب (ذكور)" g={f.patBrothers} onChange={setG("patBrothers")} />
        <GroupEditor label="أخوات لأب" g={f.patSisters} onChange={setG("patSisters")} />
        <GroupEditor label="إخوة لأم (ذكور)" g={f.matBrothers} onChange={setG("matBrothers")} />
        <GroupEditor label="أخوات لأم" g={f.matSisters} onChange={setG("matSisters")} />
      </Card>

      <Card title="العصبات الأخرى" icon="⋯">
        {!needOtherAgnates && <p className="small muted">لا تؤثر هذه الفئات غالبًا مع وجود ابن أو أب أو أخ؛ يمكنك تركها.</p>}
        <details open={needOtherAgnates}>
          <summary className="small">أبناء الإخوة والأعمام وأبناؤهم</summary>
          <GroupEditor label="أبناء الإخوة الأشقاء" g={f.fullNephews} onChange={setG("fullNephews")} />
          <GroupEditor label="أبناء الإخوة لأب" g={f.patNephews} onChange={setG("patNephews")} />
          <GroupEditor label="أبناء أبناء الإخوة الأشقاء" g={f.fullNephewSons} onChange={setG("fullNephewSons")} />
          <GroupEditor label="أبناء أبناء الإخوة لأب" g={f.patNephewSons} onChange={setG("patNephewSons")} />
          <GroupEditor label="أعمام أشقاء (إخوة الأب الأشقاء)" g={f.fullUncles} onChange={setG("fullUncles")} />
          <GroupEditor label="أعمام لأب" g={f.patUncles} onChange={setG("patUncles")} />
          <GroupEditor label="أبناء الأعمام الأشقاء" g={f.fullCousins} onChange={setG("fullCousins")} />
          <GroupEditor label="أبناء الأعمام لأب" g={f.patCousins} onChange={setG("patCousins")} />
          <GroupEditor label="أبناء أبناء الأعمام الأشقاء" g={f.fullCousinSons} onChange={setG("fullCousinSons")} />
          <GroupEditor label="أبناء أبناء الأعمام لأب" g={f.patCousinSons} onChange={setG("patCousinSons")} />
          <div className="qrow">
            <div className="q">
              عصبات أبعد (أعمام الأب أو الجد وأبناؤهم)
              <small>لا يحسبها هذا الإصدار؛ وجودها مع عدم عاصب أقرب يوقف النتيجة.</small>
            </div>
            <TriToggle label="عصبات أبعد" value={f.remoteAgnates} onChange={(v) => update((x) => void (x.family.remoteAgnates = v))} />
          </div>
        </details>
      </Card>

      <Card title="ذوو الأرحام" icon="◇">
        <div className="qrow">
          <div className="q">
            هل يوجد أحد من ذوي الأرحام على قيد الحياة؟
            <small>مثل: أولاد البنات، الخال والخالة، العمة، أولاد الأخوات، بنات الإخوة، الجد لأم. يرثون فقط عند عدم أصحاب الفروض النسبية والعصبات، ويقدَّمون على الرد على الزوجين.</small>
          </div>
          <TriToggle label="ذوو الأرحام" value={f.distantKin} onChange={(v) => update((x) => void (x.family.distantKin = v))} />
        </div>
      </Card>
    </>
  );
}
