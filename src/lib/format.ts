import { Fraction, formatEGP, toArabicDigits } from "@/engine";

export type Digits = "ar" | "en";

export const dg = (s: string | number | bigint, d: Digits) => (d === "ar" ? toArabicDigits(String(s)) : String(s));

export const fmtFrac = (f: Fraction | undefined, d: Digits) => (f ? dg(f.toString(), d) : "—");

export const fmtPct = (f: Fraction | undefined, d: Digits) => {
  if (!f) return "—";
  const s = f.toPercent(2);
  return d === "ar" ? `٪${toArabicDigits(s).replace(".", "٫")}` : `${s}%`;
};

export const fmtMoney = (p: bigint | undefined, d: Digits) => (p === undefined ? "—" : `${formatEGP(p, d === "ar")} ج.م`);

/** ISO yyyy-mm-dd → dd/MM/yyyy */
export function fmtDate(iso: string | undefined, d: Digits): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return dg(`${m[3]}/${m[2]}/${m[1]}`, d);
}

export function fmtDateTime(iso: string, d: Digits): string {
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  let h = dt.getHours();
  const ampm = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return dg(`${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(h)}:${pad(dt.getMinutes())}`, d) + ` ${ampm}`;
}

/** parse dd/MM/yyyy (Arabic or Latin digits) → ISO or null */
export function parseDate(s: string): string | null {
  const t = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).trim();
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(t);
  if (!m) return null;
  const dd = Number(m[1]),
    mm = Number(m[2]),
    yy = Number(m[3]);
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export const piToInput = (p: string | undefined) => {
  if (!p || p === "0") return "";
  const v = BigInt(p);
  const s = `${v / 100n}${v % 100n ? "." + String(v % 100n).padStart(2, "0") : ""}`;
  return s;
};
