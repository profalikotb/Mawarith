"use client";
import type { CaseResult } from "@/engine";
import { fmtFrac, fmtPct } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { personTitle } from "./ResultsTable";

const PALETTE = ["#0e6b4f", "#2d4f86", "#b8892e", "#7a3e8e", "#2f8f9d", "#a3431f", "#5c7f2a", "#8a6d3b", "#3d6fb6", "#b0507a", "#4a8f6e", "#6b5aa6"];

export default function ShareChart({ r }: { r: CaseResult }) {
  const { digits } = useSettings();
  const items = r.persons.filter((p) => p.shareOfNet.isPos());
  if (!items.length) return null;
  return (
    <figure style={{ margin: 0 }}>
      <div className="bar" role="img" aria-label="مخطط الأنصبة — التفاصيل في الجدول">
        {items.map((p, i) => (
          <span
            key={p.id}
            title={`${personTitle(p)}: ${fmtFrac(p.shareOfNet, digits)}`}
            style={{
              width: `${p.shareOfNet.toPercent(4)}%`,
              background: PALETTE[i % PALETTE.length],
              backgroundImage: i >= PALETTE.length ? "repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 4px, transparent 4px 8px)" : undefined,
            }}
          />
        ))}
      </div>
      <figcaption className="legend">
        {items.map((p, i) => (
          <span className="li" key={p.id}>
            <span className="sw" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>
              {personTitle(p)} — <b className="frac">{fmtFrac(p.shareOfNet, digits)}</b> <span className="muted small">({fmtPct(p.shareOfNet, digits)})</span>
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
