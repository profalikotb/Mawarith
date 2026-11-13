/**
 * Rule-based (non-AI) extraction of a case description such as
 * «توفي رجل عن زوجة وابنين وبنت وأم». Output is a SUGGESTION that the user
 * must confirm; it never feeds the engine directly.
 */
import { toLatinDigits } from "./money";

export interface ParsedSuggestion {
  deceasedGender?: "male" | "female";
  items: { key: SuggestKey; count: number; label: string; matched: string; countUncertain?: boolean }[];
  unrecognized: string[];
}

export type SuggestKey =
  | "husband"
  | "wives"
  | "father"
  | "mother"
  | "gf"
  | "gm_mm"
  | "gm_fm"
  | "sons"
  | "daughters"
  | "sonsSons"
  | "sonsDaughters"
  | "fullB"
  | "fullS"
  | "patB"
  | "patS"
  | "matB"
  | "matS"
  | "fullN"
  | "patN"
  | "fullU"
  | "patU"
  | "fullC"
  | "patC";

const pre = (s: string) =>
  s
    .replace(/والدة|والدته|والدتها/g, " أم ")
    .replace(/والده|والدها|والد/g, " أب ")
    .replace(/ابنتين|ابنتان/g, "بنتين")
    .replace(/ابنة|ابنته|ابنتها/g, "بنت")
    .replace(/زوجة|زوجته/g, "زوجة");

const norm = (s: string) =>
  toLatinDigits(pre(s))
    .replace(/[ً-ْٰ]/g, "") // tashkeel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[،,.:؛]/g, " و ")
    .replace(/\s+/g, " ")
    .trim();

const NUM: Record<string, number> = {
  واحد: 1, واحده: 1, اثنان: 2, اثنين: 2, اثنتان: 2, اثنتين: 2, ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4,
  خمس: 5, خمسه: 5, ست: 6, سته: 6, سبع: 7, سبعه: 7, ثماني: 8, ثمان: 8, ثمانيه: 8, تسع: 9, تسعه: 9, عشر: 10, عشره: 10,
};

interface Pattern {
  key: SuggestKey;
  label: string;
  singular: string[];
  dual: string[];
  plural: string[];
  qualifier?: RegExp; // must follow
  exact?: boolean;
}

const Q_FULL = /^\s*(الاشقاء|الشقيق|الشقيقه|شقيق|شقيقه|شقيقين|شقيقتين|شقيقان|شقيقتان|اشقاء|شقيقات)/;
const Q_PAT = /^\s*(لاب|من الاب)/;
const Q_MAT = /^\s*(لام|من الام)/;

const P: Pattern[] = [
  { key: "husband", exact: true, label: "زوج", singular: ["زوج", "زوجها"], dual: [], plural: [] },
  { key: "wives", exact: true, label: "زوجة", singular: ["زوجه", "زوجته"], dual: ["زوجتين", "زوجتان", "زوجتيه"], plural: ["زوجات"] },
  { key: "father", exact: true, label: "أب", singular: ["اب", "الاب", "ابيه", "ابوه", "ابيها"], dual: [], plural: [] },
  { key: "mother", exact: true, label: "أم", singular: ["ام", "امه", "امها", "الام"], dual: [], plural: [] },
  { key: "fullN", label: "ابن أخ شقيق", singular: ["ابن اخ"], dual: ["ابني اخ"], plural: ["ابناء اخ"], qualifier: Q_FULL },
  { key: "patN", label: "ابن أخ لأب", singular: ["ابن اخ"], dual: ["ابني اخ"], plural: ["ابناء اخ"], qualifier: Q_PAT },
  { key: "fullC", label: "ابن عم شقيق", singular: ["ابن عم"], dual: ["ابني عم"], plural: ["ابناء عم"], qualifier: Q_FULL },
  { key: "patC", label: "ابن عم لأب", singular: ["ابن عم"], dual: ["ابني عم"], plural: ["ابناء عم"], qualifier: Q_PAT },
  { key: "sonsSons", exact: true, label: "ابن ابن", singular: ["ابن ابن"], dual: ["ابني ابن", "ابنا ابن"], plural: ["ابناء ابن", "احفاد"] },
  { key: "sonsDaughters", exact: true, label: "بنت ابن", singular: ["بنت ابن"], dual: ["بنتي ابن", "بنتا ابن"], plural: ["بنات ابن"] },
  { key: "sons", exact: true, label: "ابن", singular: ["ابن", "ولد", "ابنه", "ابنها"], dual: ["ابنين", "ابنان", "ولدين", "ولدان"], plural: ["ابناء", "اولاد ذكور"] },
  { key: "daughters", exact: true, label: "بنت", singular: ["بنت"], dual: ["بنتين", "بنتان", "ابنتين", "ابنتان"], plural: ["بنات"] },
  { key: "fullB", label: "أخ شقيق", singular: ["اخ"], dual: ["اخوين", "اخوان"], plural: ["اخوه", "اخوه ذكور"], qualifier: Q_FULL },
  { key: "patB", label: "أخ لأب", singular: ["اخ"], dual: ["اخوين", "اخوان"], plural: ["اخوه"], qualifier: Q_PAT },
  { key: "matB", label: "أخ لأم", singular: ["اخ"], dual: ["اخوين", "اخوان"], plural: ["اخوه"], qualifier: Q_MAT },
  { key: "fullS", label: "أخت شقيقة", singular: ["اخت"], dual: ["اختين", "اختان"], plural: ["اخوات"], qualifier: Q_FULL },
  { key: "patS", label: "أخت لأب", singular: ["اخت"], dual: ["اختين", "اختان"], plural: ["اخوات"], qualifier: Q_PAT },
  { key: "matS", label: "أخت لأم", singular: ["اخت"], dual: ["اختين", "اختان"], plural: ["اخوات"], qualifier: Q_MAT },
  { key: "fullU", label: "عم شقيق", singular: ["عم"], dual: ["عمين", "عمان"], plural: ["اعمام"], qualifier: Q_FULL },
  { key: "patU", label: "عم لأب", singular: ["عم"], dual: ["عمين", "عمان"], plural: ["اعمام"], qualifier: Q_PAT },
  { key: "gf", label: "جد لأب", singular: ["جد", "جده لابيه", "ابو الاب", "جد لاب"], dual: [], plural: [] },
  { key: "gm_mm", label: "جدة لأم", singular: ["جده لام", "ام الام", "جده لامه"], dual: [], plural: [] },
  { key: "gm_fm", label: "جدة لأب", singular: ["جده لاب", "ام الاب", "جده لابيه"], dual: [], plural: [] },
];

export function parseCaseText(text: string): ParsedSuggestion {
  const t = norm(text);
  const out: ParsedSuggestion = { items: [], unrecognized: [] };
  if (/(توفي|توفى|مات|المتوفي)\s+(رجل|شخص ذكر|ذكر)/.test(t) || /(توفي|مات) عن/.test(t)) out.deceasedGender = "male";
  if (/(توفيت|ماتت|المتوفاه|المتوفيه|امراه|سيده|توفيت امراه)/.test(t)) out.deceasedGender = "female";

  // split on "و" conjunction and "عن"
  const rest = t.replace(/^.*?\sعن\s/, "");
  const parts = rest
    .split(/\s+و\s*|\sو(?=\S)/)
    .map((x) => x.trim())
    .filter(Boolean);

  for (let raw of parts) {
    raw = raw.replace(/^و/, "").replace(/^(ال)(?=ابن|بنت|اخ|اخت|عم|زوج|ام|اب|جد)/, "").trim();
    let count = 1;
    let body = raw;
    const numMatch = /^(\d+)\s+(.*)$/.exec(raw);
    if (numMatch) {
      count = Number(numMatch[1]);
      body = numMatch[2];
    } else {
      const w = raw.split(" ")[0];
      if (NUM[w] && raw.split(" ").length > 1) {
        count = NUM[w];
        body = raw.slice(w.length).trim();
      }
    }
    let matched = false;
    for (const p of P) {
      const forms: [string[], number | null][] = [
        [p.plural, null],
        [p.dual, 2],
        [p.singular, 1],
      ];
      for (const [list, fixed] of forms) {
        for (const form of list.sort((a, b) => b.length - a.length)) {
          if (body === form || (!p.exact && body.startsWith(form + " "))) {
            const after = body.slice(form.length);
            if (p.qualifier && !p.qualifier.test(after)) continue;
            if (!p.qualifier && (Q_FULL.test(after) || Q_PAT.test(after) || Q_MAT.test(after)) && /^(اخ|اخت|عم|ابن اخ|ابن عم)/.test(form)) continue;
            const explicit = !!numMatch || !!NUM[raw.split(" ")[0]];
            const n = fixed !== null ? (explicit && fixed === 1 ? count : fixed) : explicit ? count : 3;
            out.items.push({ key: p.key, count: n, label: p.label, matched: raw, countUncertain: fixed === null && !explicit });
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (matched) break;
    }
    if (!matched) {
      // unqualified siblings
      if (/^(اخ|اخوين|اخوان|اخوه|اخت|اختين|اخوات|عم|ابن اخ|ابن عم)/.test(body))
        out.unrecognized.push(`${raw} (حدد: شقيق أم لأب أم لأم)`);
      else out.unrecognized.push(raw);
    }
  }
  // husband vs wife consistency
  if (out.items.some((i) => i.key === "husband")) out.deceasedGender = out.deceasedGender ?? "female";
  if (out.items.some((i) => i.key === "wives")) out.deceasedGender = out.deceasedGender ?? "male";
  return out;
}
