"use client";
import Link from "next/link";
import { basisText, RULES, type CaseResult, type PersonResult } from "@/engine";
import { dg, fmtFrac, fmtMoney, fmtPct } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export const ROLE_BADGE: Record<string, { t: string; cls: string; ic: string }> = {
  heir: { t: "وارث", cls: "heir", ic: "✓" },
  blocked: { t: "محجوب", cls: "blocked", ic: "⊘" },
  excluded: { t: "غير وارث", cls: "excluded", ic: "✕" },
  wajiba: { t: "مستحق وصية واجبة", cls: "wajiba", ic: "◆" },
  will: { t: "موصى له", cls: "will", ic: "✎" },
  treasury: { t: "الخزانة العامة", cls: "neutral", ic: "▣" },
};

export function personTitle(p: PersonResult) {
  return p.name ? p.name : p.relation;
}

export default function ResultsTable({ r, showMoney }: { r: CaseResult; showMoney: boolean }) {
  const { digits } = useSettings();
  const hasWills = r.wajiba.total.isPos() || r.wills.executedTotal.isPos();
  return (
    <>
    <div className="rcards" aria-label="الاستحقاقات">
      {r.persons.map((p) => {
        const b = ROLE_BADGE[p.role];
        const zero = !p.shareOfNet.isPos();
        return (
          <div key={p.id} className={`rcard ${zero ? "dim" : ""}`}>
            <div className="row">
              <b>{personTitle(p)}</b>
              <span className="small muted">{p.name ? p.relation : ""}</span>
              <span className="spacer" />
              <span className={`badge ${b.cls}`}>
                <span aria-hidden>{b.ic}</span> {b.t}
              </span>
            </div>
            <div className="rnums">
              <div>
                <span className="k">النصيب</span>
                <span className="frac">{fmtFrac(p.shareOfNet, digits)}</span>
              </div>
              <div>
                <span className="k">النسبة</span>
                <span className="num">{zero ? "—" : fmtPct(p.shareOfNet, digits)}</span>
              </div>
              <div>
                <span className="k">الأسهم</span>
                <span className="num">{p.sahmNet ? dg(p.sahmNet.toString(), digits) : "—"}</span>
              </div>
              {showMoney && (
                <div>
                  <span className="k">القيمة</span>
                  <span className="num">{fmtMoney(p.amount, digits)}</span>
                </div>
              )}
            </div>
            <div className="small">
              {p.role !== "blocked" && p.role !== "excluded" && <b style={{ display: "inline" }}>{basisText(p.basis)}: </b>}
              {p.reason}
              {p.groupCount > 1 && p.role === "heir" && (
                <span className="muted">
                  {" "}— ضمن {p.groupLabel} ({dg(p.groupCount, digits)})، للمجموعة {fmtFrac(p.groupShareOfPool, digits)}
                </span>
              )}
            </div>
            {p.ruleIds[0] && (
              <Link className="small" href={`/references#${p.ruleIds[0]}`}>
                {RULES[p.ruleIds[0]]?.law ?? p.ruleIds[0]}
              </Link>
            )}
          </div>
        );
      })}
      <div className="rcard small">
        المجموع: <span className="frac">{fmtFrac(r.persons.reduce((a, p) => a.add(p.shareOfNet), r.pool.sub(r.pool)), digits)}</span> — {r.balanceOk ? "✓ متزن" : "✕ غير متزن"}
        {showMoney && <> · {fmtMoney(r.persons.reduce((s, p) => s + (p.amount ?? 0n), 0n), digits)}</>}
      </div>
    </div>
    <div className="table-wrap rtable">
      <table className="t">
        <caption className="sr-only">جدول الاستحقاقات</caption>
        <thead>
          <tr>
            <th>المستحق</th>
            <th>الصلة</th>
            <th>الحالة</th>
            <th>السبب والأساس</th>
            {hasWills && <th className="n">النصيب الشرعي</th>}
            <th className="n">{hasWills ? "من صافي التركة" : "النصيب"}</th>
            <th className="n">النسبة</th>
            <th className="n">الأسهم</th>
            {showMoney && <th className="n">القيمة</th>}
            <th>المرجع</th>
          </tr>
        </thead>
        <tbody>
          {r.persons.map((p) => {
            const b = ROLE_BADGE[p.role];
            const zero = !p.shareOfNet.isPos();
            return (
              <tr key={p.id} className={zero ? "dim" : ""}>
                <td>
                  <b>{personTitle(p)}</b>
                  {p.groupCount > 1 && p.role === "heir" && (
                    <div className="small muted">
                      ضمن {p.groupLabel} ({dg(p.groupCount, digits)}) — للمجموعة {fmtFrac(p.groupShareOfPool, digits)}
                    </div>
                  )}
                  {p.note && <div className="small muted">{p.note}</div>}
                </td>
                <td>{p.relation}</td>
                <td>
                  <span className={`badge ${b.cls}`}>
                    <span aria-hidden>{b.ic}</span> {b.t}
                  </span>
                </td>
                <td className="small">
                  {p.role !== "blocked" && p.role !== "excluded" && <b style={{ display: "inline" }}>{basisText(p.basis)}: </b>}
                  {p.reason}
                </td>
                {hasWills && <td className="n">{p.shareOfPool ? <span className="frac">{fmtFrac(p.shareOfPool, digits)}</span> : "—"}</td>}
                <td className="n">
                  <span className="frac">{fmtFrac(p.shareOfNet, digits)}</span>
                </td>
                <td className="n">{zero ? "—" : fmtPct(p.shareOfNet, digits)}</td>
                <td className="n">{p.sahmNet ? dg(p.sahmNet.toString(), digits) : "—"}</td>
                {showMoney && <td className="n">{fmtMoney(p.amount, digits)}</td>}
                <td className="small">
                  {p.ruleIds.slice(0, 3).map((id) => (
                    <Link key={id} href={`/references#${id}`} title={RULES[id]?.summary} style={{ display: "block" }}>
                      {RULES[id]?.law?.replace("قانون المواريث رقم 77 لسنة 1943", "ق77/1943").replace("قانون الوصية رقم 71 لسنة 1946", "ق71/1946") ?? id}
                    </Link>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={hasWills ? 5 : 4}>المجموع (تحقق الاتزان)</td>
            <td className="n">
              <span className="frac">{fmtFrac(r.persons.reduce((a, p) => a.add(p.shareOfNet), r.pool.sub(r.pool)), digits)}</span>
            </td>
            <td className="n">{r.balanceOk ? "✓ متزن" : "✕ غير متزن"}</td>
            <td className="n">{dg(r.tashihNet.toString(), digits)}</td>
            {showMoney && <td className="n">{fmtMoney(r.persons.reduce((s, p) => s + (p.amount ?? 0n), 0n), digits)}</td>}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
}
