"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Issue, Tri } from "@/engine";
import { parseMoneyToPiasters } from "@/engine";
import { parseDate, fmtDate, piToInput } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export function TriToggle({ value, onChange, labels, label }: { value: Tri; onChange: (v: Tri) => void; labels?: [string, string, string]; label: string }) {
  const [y, n, u] = labels ?? ["موجود", "غير موجود", "غير معلوم"];
  return (
    <div className="seg" role="group" aria-label={label}>
      <button type="button" aria-pressed={value === "yes"} onClick={() => onChange("yes")}>
        {value === "yes" ? "✓ " : ""}
        {y}
      </button>
      <button type="button" className="no" aria-pressed={value === "no"} onClick={() => onChange("no")}>
        {value === "no" ? "✕ " : ""}
        {n}
      </button>
      <button type="button" className="unknown" aria-pressed={value === "unknown"} onClick={() => onChange("unknown")}>
        {value === "unknown" ? "؟ " : ""}
        {u}
      </button>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {value === o.v ? "✓ " : ""}
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function MoneyInput({ value, onChange, label, hint, id }: { value: string; onChange: (p: string) => void; label: string; hint?: string; id?: string }) {
  const [text, setText] = useState(piToInput(value));
  const [err, setErr] = useState(false);
  useEffect(() => {
    // external reset
    const cur = parseMoneyToPiasters(text);
    if (cur === null || cur.toString() !== (value || "0")) setText(piToInput(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label} <span className="hint">(جنيه مصري)</span>
      </span>
      <input
        id={id}
        className="money"
        inputMode="decimal"
        value={text}
        placeholder="0"
        aria-invalid={err}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseMoneyToPiasters(e.target.value);
          setErr(p === null);
          if (p !== null) onChange(p.toString());
        }}
      />
      {err && <span className="hint" style={{ color: "var(--danger)" }}>أدخل رقمًا صحيحًا (حتى قرشين بعد العلامة العشرية).</span>}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function DateInput({ value, onChange, label, hint }: { value?: string; onChange: (iso: string) => void; label: string; hint?: string }) {
  const { digits } = useSettings();
  const [text, setText] = useState(value ? fmtDate(value, "en") : "");
  const [err, setErr] = useState(false);
  return (
    <label className="field">
      <span>
        {label} <span className="hint">(يوم/شهر/سنة)</span>
      </span>
      <input
        className="ltr"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        aria-invalid={err}
        onChange={(e) => {
          setText(e.target.value);
          if (!e.target.value.trim()) {
            setErr(false);
            onChange("");
            return;
          }
          const iso = parseDate(e.target.value);
          setErr(!iso);
          if (iso) onChange(iso);
        }}
      />
      {err ? <span className="hint" style={{ color: "var(--danger)" }}>تاريخ غير صحيح. مثال: 15/03/2024</span> : value ? <span className="hint">{fmtDate(value, digits)}</span> : null}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function NumberInput({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="row" role="group" aria-label={label}>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label="إنقاص">
        −
      </button>
      <span className="num" style={{ minWidth: 34, textAlign: "center", fontWeight: 700, fontSize: "1.15rem" }} aria-live="polite">
        {value}
      </span>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.min(max, value + 1))} aria-label="زيادة">
        +
      </button>
      <span className="small muted">{label}</span>
    </div>
  );
}

const ICON: Record<string, string> = { stop: "⛔", review: "⚠", info: "ℹ", ok: "✓" };
const TITLE: Record<string, string> = { stop: "يوقف الحساب النهائي", review: "يحتاج مراجعة", info: "ملاحظة" };

export function IssueList({ issues, filter }: { issues: Issue[]; filter?: Issue["severity"][] }) {
  const list = filter ? issues.filter((i) => filter.includes(i.severity)) : issues;
  if (!list.length) return null;
  const order = { stop: 0, review: 1, info: 2 } as const;
  return (
    <div>
      {[...list]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((i, k) => (
          <div key={k} className={`alert ${i.severity}`} role={i.severity === "stop" ? "alert" : undefined}>
            <span className="ic" aria-hidden>
              {ICON[i.severity]}
            </span>
            <div>
              <span className="small muted">{TITLE[i.severity]}</span>
              <div>{i.message}</div>
              {i.needed && (
                <div className="small">
                  <b style={{ display: "inline" }}>المطلوب: </b>
                  {i.needed}
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

export function Card({ title, children, actions, icon }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; icon?: string }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="section-title">
          {title && (
            <h2>
              {icon && <span aria-hidden>{icon}</span>}
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}
