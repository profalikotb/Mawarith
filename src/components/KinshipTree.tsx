"use client";
import { groupLabel, relationText, type CaseInput, type Descendant, type Group, type Tri } from "@/engine";

type Kind = "spouse" | "asc" | "desc" | "coll";
const ST: Record<string, string> = {
  alive: "● حي وقت الوفاة",
  predeceased: "✝ توفي قبله",
  simultaneous: "✝ توفي معه",
  died_after: "◐ توفي بعده",
  unknown: "؟ غير معلوم",
};

function Node({ rel, name, kind, st }: { rel: string; name?: string; kind: Kind; st: string }) {
  const cls = st === "predeceased" || st === "simultaneous" ? "dead" : st === "unknown" ? "unknown" : "";
  return (
    <div className={`knode ${kind} ${cls}`}>
      <div className="rel">{rel}</div>
      {name && <div className="nm">{name}</div>}
      <span className="st">{ST[st] ?? st}</span>
    </div>
  );
}

const triSt = (t: Tri) => (t === "yes" ? "alive" : t === "unknown" ? "unknown" : "");

function DescTree({ list, path }: { list: Descendant[]; path: ("male" | "female")[] }) {
  if (!list.length) return null;
  return (
    <ul className="dtree">
      {list.map((d) => (
        <li key={d.id}>
          <Node rel={relationText([...path, d.gender])} name={d.name} kind="desc" st={d.status} />
          <DescTree list={d.children} path={[...path, d.gender]} />
        </li>
      ))}
    </ul>
  );
}

export default function KinshipTree({ c }: { c: CaseInput }) {
  const f = c.family;
  const asc: { rel: string; name?: string; st: string }[] = [];
  if (triSt(f.father.state)) asc.push({ rel: "الأب", name: f.father.name, st: triSt(f.father.state) });
  if (triSt(f.mother.state)) asc.push({ rel: "الأم", name: f.mother.name, st: triSt(f.mother.state) });
  if (triSt(f.paternalGrandfather.state)) asc.push({ rel: "الجد لأب", st: triSt(f.paternalGrandfather.state) });
  const gmL: Record<string, string> = { mm: "أم الأم", fm: "أم الأب", mmm: "أم أم الأم", fmm: "أم أم الأب", ffm: "أم أبي الأب" };
  for (const k of Object.keys(gmL) as (keyof typeof f.gm)[]) if (triSt(f.gm[k])) asc.push({ rel: `الجدة ${gmL[k]}`, st: triSt(f.gm[k]) });

  const spouses: { rel: string; name?: string; st: string }[] = [];
  if (c.meta.deceasedGender === "female" && triSt(f.husband.state)) spouses.push({ rel: "الزوج", name: f.husband.name, st: triSt(f.husband.state) });
  if (c.meta.deceasedGender === "male" && f.wives.state !== "no") {
    if (f.wives.state === "unknown") spouses.push({ rel: "زوجة؟", st: "unknown" });
    else f.wives.list.forEach((w, i) => spouses.push({ rel: w.status === "bain" ? "مطلقة بائن" : `الزوجة ${i + 1}`, name: w.name, st: "alive" }));
  }

  const colls: { rel: string; name?: string; st: string }[] = [];
  const gl: [Group, string][] = [
    [f.fullBrothers, "fullB"],
    [f.fullSisters, "fullS"],
    [f.patBrothers, "patB"],
    [f.patSisters, "patS"],
    [f.matBrothers, "matB"],
    [f.matSisters, "matS"],
    [f.fullNephews, "fullN"],
    [f.patNephews, "patN"],
    [f.fullUncles, "fullU"],
    [f.patUncles, "patU"],
    [f.fullCousins, "fullC"],
    [f.patCousins, "patC"],
  ];
  for (const [g, k] of gl) {
    if (g.state === "no") continue;
    colls.push({ rel: `${groupLabel(k, g.count)}${g.count > 1 ? ` (${g.count})` : ""}`, name: (g.names || []).filter(Boolean).join("، ") || undefined, st: g.state === "yes" ? "alive" : "unknown" });
  }

  return (
    <div className="ktree" aria-label="شجرة القرابة">
      {asc.length > 0 && (
        <>
          <div className="tier-label">الأصول</div>
          <div className="tier">
            {asc.map((n, i) => (
              <Node key={i} {...n} kind="asc" />
            ))}
          </div>
          <div className="vline" />
        </>
      )}
      <div className="tier">
        {spouses.map((n, i) => (
          <Node key={`s${i}`} {...n} kind="spouse" />
        ))}
        <div className="knode center">
          <div className="rel">المتوفى{c.meta.deceasedGender === "female" ? "ة" : ""}</div>
          {c.meta.deceasedName && <div className="nm">{c.meta.deceasedName}</div>}
        </div>
      </div>
      {colls.length > 0 && (
        <>
          <div className="tier-label">الحواشي (الإخوة والأعمام وأبناؤهم)</div>
          <div className="tier">
            {colls.map((n, i) => (
              <Node key={`c${i}`} {...n} kind="coll" />
            ))}
          </div>
        </>
      )}
      {f.children.length > 0 && (
        <>
          <div className="vline" />
          <div className="tier-label">الفروع</div>
          <div style={{ width: "100%" }}>
            <DescTree list={f.children} path={[]} />
          </div>
        </>
      )}
      <div className="legend small" aria-label="مفتاح الشجرة">
        <span className="li">
          <span className="sw" style={{ background: "var(--c-spouse)" }} />
          الزوجية
        </span>
        <span className="li">
          <span className="sw" style={{ background: "var(--c-asc)" }} />
          الأصول
        </span>
        <span className="li">
          <span className="sw" style={{ background: "var(--c-desc)" }} />
          الفروع
        </span>
        <span className="li">
          <span className="sw" style={{ background: "var(--c-coll)" }} />
          الحواشي
        </span>
        <span className="li">إطار متقطع = متوفى قبل المورث أو معه · منقّط = غير معلوم</span>
      </div>
    </div>
  );
}
