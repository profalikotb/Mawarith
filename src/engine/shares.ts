/**
 * Core share engine — Egyptian Law 77/1943 (Muslims).
 * Input: fully-determined heir counts. Output: exact fractional shares of the
 * inheritance pool per group, with reasons, rule references and a trace.
 *
 * The engine never guesses: unsupported configurations produce a "stop" issue.
 */
import { Fraction, F, lcm } from "./fraction";
import { groupLabel, groupOrder } from "./labels";
import type { Basis, GroupKey, GroupShare, HeirCounts, Issue, ShareResult, Step } from "./types";

interface Draft {
  key: GroupKey;
  count: number;
  gender: "male" | "female" | "mixed";
  fard?: Fraction; // group fard (total)
  asabaWeight?: number; // per-person weight inside the active asaba class
  asabaKind?: "asaba_nafs" | "asaba_ghayr" | "asaba_maa_ghayr";
  blocked?: string;
  reason: string[];
  ruleIds: string[];
  total: Fraction;
  basis: Basis;
}

const ZERO = Fraction.ZERO;
const ONE = Fraction.ONE;
const SIXTH = F(1, 6);

export function computeShares(h: HeirCounts): ShareResult {
  const steps: Step[] = [];
  const issues: Issue[] = [];
  const special: string[] = [];
  const drafts = new Map<GroupKey, Draft>();

  const add = (key: GroupKey, count: number, gender: Draft["gender"]): Draft => {
    const d: Draft = { key, count, gender, reason: [], ruleIds: [], total: ZERO, basis: "none" };
    drafts.set(key, d);
    return d;
  };
  const block = (d: Draft, why: string, ruleId: string) => {
    d.blocked = why;
    d.basis = "blocked";
    d.reason.push(why);
    d.ruleIds.push(ruleId);
    steps.push({ ruleId, text: `${groupLabel(d.key, d.count)}: محجوب — ${why}.` });
  };
  const setFard = (d: Draft, fr: Fraction, why: string, ruleId: string) => {
    d.fard = fr;
    d.reason.push(why);
    d.ruleIds.push(ruleId);
    steps.push({ ruleId, text: `${groupLabel(d.key, d.count)}: ${fr.toString()} فرضًا — ${why}.` });
  };
  const setAsaba = (d: Draft, w: number, kind: Draft["asabaKind"], why: string, ruleId: string) => {
    d.asabaWeight = w;
    d.asabaKind = kind;
    d.reason.push(why);
    d.ruleIds.push(ruleId);
    steps.push({ ruleId, text: `${groupLabel(d.key, d.count)}: ${why}.` });
  };

  /* ------------------------------ descendants ----------------------------- */
  const levels = h.desc;
  const maleLevel = levels.findIndex((l) => l.sons > 0); // 0-based
  const hasMaleDesc = maleLevel >= 0;
  const hasDesc = levels.some((l) => l.sons + l.daughters > 0);
  const femaleDescHeir = !hasMaleDesc && levels.some((l) => l.daughters > 0);

  const descDrafts: Draft[] = [];
  let twoThirds: "none" | "half" | "full" = "none";
  levels.forEach((l, i) => {
    const lvl = i + 1;
    const mk = `desc${lvl}_m` as GroupKey;
    const fk = `desc${lvl}_f` as GroupKey;
    const sonD = l.sons > 0 ? add(mk, l.sons, "male") : undefined;
    const dauD = l.daughters > 0 ? add(fk, l.daughters, "female") : undefined;
    if (sonD) descDrafts.push(sonD);
    if (dauD) descDrafts.push(dauD);
    const higherMale = lvl === 2 ? "الابن" : "ابن أو ابن ابن أعلى درجة";
    if (hasMaleDesc && i > maleLevel) {
      if (sonD) block(sonD, `لوجود ${higherMale}`, "EG77-16-18");
      if (dauD) block(dauD, `لوجود ${higherMale}`, "EG77-27");
      return;
    }
    if (i === maleLevel) {
      setAsaba(sonD!, 2, "asaba_nafs", "عصبة بالنفس (جهة البنوة)، يأخذ الباقي", "EG77-16-18");
      if (dauD) setAsaba(dauD, 1, "asaba_ghayr", "عصبة بالغير مع من في درجتها من الذكور، للذكر مثل حظ الأنثيين", "EG77-19");
      return;
    }
    // i < maleLevel or no male descendants: only daughters here
    if (!dauD) return;
    if (twoThirds === "none") {
      const fr = l.daughters === 1 ? F(1, 2) : F(2, 3);
      setFard(dauD, fr, l.daughters === 1 ? "انفردت ولا معصب لها" : "اثنتان فأكثر ولا معصب لهن", "EG77-12");
      twoThirds = l.daughters === 1 ? "half" : "full";
    } else if (twoThirds === "half") {
      setFard(dauD, SIXTH, "تكملة الثلثين مع البنت أو بنت الابن الأعلى", "EG77-12");
      twoThirds = "full";
    } else if (hasMaleDesc && i < maleLevel) {
      setAsaba(dauD, 1, "asaba_ghayr", "استُغرق الثلثان، فعصّبها ابن ابنٍ أنزل منها، للذكر مثل حظ الأنثيين", "EG77-19");
    } else {
      block(dauD, "لاستغراق البنتين أو بنتي الابن الأعلى الثلثين ولا معصب لها", "EG77-27");
    }
  });

  /* -------------------------------- spouses ------------------------------- */
  let spouseFard: Fraction | undefined;
  if (h.husband) {
    const d = add("husband", 1, "male");
    spouseFard = hasDesc ? F(1, 4) : F(1, 2);
    setFard(d, spouseFard, hasDesc ? "لوجود الفرع الوارث" : "لعدم الفرع الوارث", "EG77-11");
  }
  if (h.wives) {
    const d = add("wives", h.wives, "female");
    spouseFard = hasDesc ? F(1, 8) : F(1, 4);
    setFard(
      d,
      spouseFard,
      `${hasDesc ? "لوجود الفرع الوارث" : "لعدم الفرع الوارث"}${h.wives > 1 ? "، يقسم بين الزوجات بالتساوي" : ""}`,
      "EG77-11",
    );
  }

  /* ---------------------------- father/grandfather ------------------------ */
  const hasF = h.father > 0;
  const hasGF = !hasF && h.gf > 0;
  let fatherD: Draft | undefined;
  let gfD: Draft | undefined;
  if (h.father) {
    fatherD = add("father", 1, "male");
    if (hasMaleDesc) setFard(fatherD, SIXTH, "لوجود الفرع الوارث المذكر", "EG77-9");
    else if (femaleDescHeir) {
      setFard(fatherD, SIXTH, "مع الفرع الوارث المؤنث", "EG77-21");
      setAsaba(fatherD, 2, "asaba_nafs", "ويأخذ الباقي تعصيبًا", "EG77-21");
    } else setAsaba(fatherD, 2, "asaba_nafs", "عصبة بالنفس لعدم الفرع الوارث، يأخذ الباقي", "EG77-16-18");
  }
  if (h.gf) {
    gfD = add("gf", 1, "male");
    if (hasF) block(gfD, "لوجود الأب", "EG77-16-18");
  }

  /* --------------------------------- mother ------------------------------- */
  const siblingsAll = h.fullB + h.fullS + h.patB + h.patS + h.matB + h.matS;
  if (h.mother) {
    const d = add("mother", 1, "female");
    if (hasDesc) setFard(d, SIXTH, "لوجود الفرع الوارث", "EG77-14");
    else if (siblingsAll >= 2) setFard(d, SIXTH, "لوجود اثنين فأكثر من الإخوة والأخوات (ولو كانوا محجوبين)", "EG77-14");
    else if (spouseFard && hasF) {
      const fr = ONE.sub(spouseFard).divInt(3);
      setFard(d, fr, "ثلث الباقي بعد فرض الزوج/الزوجة لاجتماعها مع أحد الزوجين والأب فقط (العمرية)", "EG77-14");
      special.push("العمرية");
    } else setFard(d, F(1, 3), "لعدم الفرع الوارث وعدم الجمع من الإخوة", "EG77-14");
  }

  /* ------------------------------ grandmothers ---------------------------- */
  {
    const gmKeys: { k: "mm" | "fm" | "mmm" | "fmm" | "ffm"; level: number; paternal: boolean; gfAsl: boolean }[] = [
      { k: "mm", level: 1, paternal: false, gfAsl: false },
      { k: "fm", level: 1, paternal: true, gfAsl: false },
      { k: "mmm", level: 2, paternal: false, gfAsl: false },
      { k: "fmm", level: 2, paternal: true, gfAsl: false },
      { k: "ffm", level: 2, paternal: true, gfAsl: true },
    ];
    const present = gmKeys.filter((g) => h.gm[g.k] > 0);
    const gmD = new Map<string, Draft>();
    for (const g of present) gmD.set(g.k, add(`gm_${g.k}` as GroupKey, 1, "female"));
    const eligible: typeof present = [];
    for (const g of present) {
      const d = gmD.get(g.k)!;
      if (h.mother) block(d, "لوجود الأم", "EG77-25");
      else if (g.paternal && hasF) block(d, "لوجود الأب", "EG77-25");
      else if (g.gfAsl && h.gf) block(d, "لوجود الجد وهي أصل له", "EG77-25");
      else eligible.push(g);
    }
    if (eligible.length) {
      const nearest = Math.min(...eligible.map((g) => g.level));
      const winners = eligible.filter((g) => g.level === nearest);
      for (const g of eligible) {
        if (g.level > nearest) block(gmD.get(g.k)!, "لوجود جدة أقرب منها", "EG77-25");
      }
      // edge: a nearer grandmother exists but is herself blocked (e.g. by father) while a farther one inherits
      const blockedNearer = present.some((g) => g.level < nearest);
      if (blockedNearer) {
        issues.push({
          code: "GM_EDGE",
          severity: "review",
          message:
            "توجد جدة أقرب محجوبة وجدة أبعد وارثة؛ في أثر الجدة القريبة المحجوبة على البعيدة تفصيل فقهي يحتاج إلى مراجعة متخصص.",
        });
      }
      const each = SIXTH.divInt(winners.length);
      for (const g of winners) {
        setFard(gmD.get(g.k)!, each, winners.length > 1 ? "السدس يقسم بين الجدات المتساويات في الدرجة" : "السدس لعدم الأم", "EG77-14-GM");
      }
    }
  }

  /* ------------------------------ maternal siblings ------------------------ */
  const matN = h.matB + h.matS;
  const matDrafts: Draft[] = [];
  if (matN > 0) {
    const mb = h.matB ? add("matB", h.matB, "male") : undefined;
    const ms = h.matS ? add("matS", h.matS, "female") : undefined;
    for (const d of [mb, ms]) if (d) matDrafts.push(d);
    const why = hasDesc ? "لوجود الفرع الوارث" : hasF ? "لوجود الأب" : hasGF ? "لوجود الجد" : "";
    if (why) for (const d of matDrafts) block(d, why, "EG77-26");
    else {
      const total = matN === 1 ? SIXTH : F(1, 3);
      for (const d of matDrafts) {
        setFard(
          d,
          total.mulInt(d.count).divInt(matN),
          matN === 1 ? "السدس للواحد" : "الثلث للاثنين فأكثر، ذكورهم وإناثهم سواء",
          "EG77-10",
        );
      }
    }
  }

  /* ------------------------ full & paternal siblings ----------------------- */
  const fbD = h.fullB ? add("fullB", h.fullB, "male") : undefined;
  const fsD = h.fullS ? add("fullS", h.fullS, "female") : undefined;
  const pbD = h.patB ? add("patB", h.patB, "male") : undefined;
  const psD = h.patS ? add("patS", h.patS, "female") : undefined;

  const gfWithSiblings = hasGF && !hasMaleDesc && h.fullB + h.fullS + h.patB + h.patS > 0;
  let gfMode: "none" | "muqasama" | "residue" = "none";

  if (hasMaleDesc || hasF) {
    const why = hasMaleDesc ? "لوجود الفرع الوارث المذكر" : "لوجود الأب";
    for (const d of [fbD, fsD]) if (d) block(d, why, "EG77-28");
    for (const d of [pbD, psD]) if (d) block(d, why, "EG77-29");
  } else {
    // paternal siblings blocked by full brother / full sister asaba-ma'a-ghayr
    const fullSisterMaaGhayr = !h.fullB && h.fullS > 0 && femaleDescHeir;
    if (h.fullB) {
      for (const d of [pbD, psD]) if (d) block(d, "لوجود الأخ الشقيق", "EG77-29");
    } else if (fullSisterMaaGhayr) {
      for (const d of [pbD, psD]) if (d) block(d, "لوجود الأخت الشقيقة العاصبة مع الغير", "EG77-29");
    }

    if (gfWithSiblings) {
      const fullPresent = h.fullB + h.fullS > 0;
      const patEffective = !h.fullB && !fullSisterMaaGhayr && h.patB + h.patS > 0;
      if (fullPresent && patEffective) {
        issues.push({
          code: "GF_MIXED",
          severity: "stop",
          message:
            "اجتماع الجد مع إخوة أشقاء وإخوة لأب غير محجوبين معًا من المسائل الخلافية التي لا يحسمها هذا الإصدار.",
          needed: "عرض المسألة على متخصص في الفرائض.",
        });
      }
      const B = fullPresent ? h.fullB : h.patB;
      const S = fullPresent ? h.fullS : h.patS;
      const bD = fullPresent ? fbD : pbD;
      const sD = fullPresent ? fsD : psD;
      issues.push({
        code: "GF_SIBLINGS",
        severity: "review",
        message: "مسألة الجد مع الإخوة طُبقت فيها المادة 22 من القانون المصري؛ يُنصح بمراجعتها لدى متخصص.",
      });
      special.push("الجد مع الإخوة");
      if (B > 0 || (S > 0 && femaleDescHeir)) {
        gfMode = "muqasama";
        if (bD) setAsaba(bD, 2, "asaba_nafs", "يقاسمهم الجد كأخ", "EG77-22");
        if (sD)
          setAsaba(
            sD,
            1,
            B > 0 ? "asaba_ghayr" : "asaba_maa_ghayr",
            B > 0 ? "عصبة بالغير مع الإخوة، والجد يقاسم كأخ" : "عصبة مع الفرع الوارث المؤنث، والجد يقاسم كأخ",
            "EG77-22",
          );
      } else {
        gfMode = "residue";
        const fr = S === 1 ? F(1, 2) : F(2, 3);
        setFard(sD!, fr, "صاحبات فرض مع الجد، ويأخذ الجد الباقي", "EG77-22");
      }
    } else {
      // regular siblings logic (no grandfather interplay)
      if (h.fullB) {
        setAsaba(fbD!, 2, "asaba_nafs", "عصبة بالنفس (جهة الأخوة)", "EG77-16-18");
        if (fsD) setAsaba(fsD, 1, "asaba_ghayr", "عصبة بالغير مع الأخ الشقيق، للذكر مثل حظ الأنثيين", "EG77-19");
      } else if (fsD) {
        if (femaleDescHeir) setAsaba(fsD, 1, "asaba_maa_ghayr", "عصبة مع الغير (مع الفرع الوارث المؤنث)", "EG77-20");
        else if (!hasDesc)
          setFard(fsD, h.fullS === 1 ? F(1, 2) : F(2, 3), h.fullS === 1 ? "انفردت ولا معصب ولا فرع وارث" : "اثنتان فأكثر", "EG77-13");
      }
      if (!h.fullB && !fullSisterMaaGhayr) {
        if (h.patB) {
          setAsaba(pbD!, 2, "asaba_nafs", "عصبة بالنفس (الإخوة لأب)", "EG77-16-18");
          if (psD) setAsaba(psD, 1, "asaba_ghayr", "عصبة بالغير مع الأخ لأب، للذكر مثل حظ الأنثيين", "EG77-19");
        } else if (psD) {
          if (femaleDescHeir) setAsaba(psD, 1, "asaba_maa_ghayr", "عصبة مع الغير (مع الفرع الوارث المؤنث)", "EG77-20");
          else if (h.fullS === 0) setFard(psD, h.patS === 1 ? F(1, 2) : F(2, 3), "لعدم الشقيقة والمعصب", "EG77-13");
          else if (h.fullS === 1) setFard(psD, SIXTH, "تكملة الثلثين مع الأخت الشقيقة الواحدة", "EG77-13");
          else block(psD, "لاستغراق الأختين الشقيقتين الثلثين ولا أخ لأب يعصبها", "EG77-29");
        }
      }
    }
  }

  /* --------------------------- grandfather (no F) ------------------------- */
  if (gfD && hasGF) {
    if (hasMaleDesc) setFard(gfD, SIXTH, "لوجود الفرع الوارث المذكر (يقوم مقام الأب)", "EG77-9");
    else if (gfWithSiblings) {
      // handled in resolution
      gfD.reason.push("الجد مع الإخوة — المادة 22");
      gfD.ruleIds.push("EG77-22");
    } else if (femaleDescHeir) {
      setFard(gfD, SIXTH, "مع الفرع الوارث المؤنث", "EG77-21");
      setAsaba(gfD, 2, "asaba_nafs", "ويأخذ الباقي تعصيبًا", "EG77-21");
    } else setAsaba(gfD, 2, "asaba_nafs", "عصبة بالنفس (جهة الأبوة) عند عدم الأب", "EG77-16-18");
  }

  /* ------------------------------ remote agnates -------------------------- */
  const closerAgnate =
    hasMaleDesc ||
    hasF ||
    hasGF ||
    h.fullB > 0 ||
    h.patB > 0 ||
    (femaleDescHeir && (h.fullS > 0 || h.patS > 0));
  const chain: { key: GroupKey; n: number }[] = [
    { key: "fullN", n: h.fullN },
    { key: "patN", n: h.patN },
    { key: "fullNS", n: h.fullNS },
    { key: "patNS", n: h.patNS },
    { key: "fullU", n: h.fullU },
    { key: "patU", n: h.patU },
    { key: "fullC", n: h.fullC },
    { key: "patC", n: h.patC },
    { key: "fullCS", n: h.fullCS },
    { key: "patCS", n: h.patCS },
  ];
  let winner: GroupKey | undefined;
  for (const c of chain) {
    if (!c.n) continue;
    const d = add(c.key, c.n, "male");
    if (closerAgnate) block(d, "لوجود عاصب أقرب جهةً أو درجةً", "EG77-16-18");
    else if (winner) block(d, `لوجود ${groupLabel(winner)} وهو أقرب أو أقوى`, "EG77-16-18");
    else {
      winner = c.key;
      setAsaba(d, 1, "asaba_nafs", "أقرب العصبات بالنفس الموجودين", "EG77-16-18");
    }
  }

  /* -------------------------------- resolution ---------------------------- */
  const all = [...drafts.values()];
  const fardOf = (excludeKeys: GroupKey[] = []) =>
    Fraction.sum(all.filter((d) => d.fard && !d.blocked && !excludeKeys.includes(d.key)).map((d) => d.fard!));

  // grandfather with siblings: decide whether GF is asaba or 1/6 fard
  if (gfD && gfWithSiblings) {
    const Sf = fardOf();
    const R = ONE.sub(Sf);
    const sibAsaba = all.filter((d) => d.asabaWeight && !d.blocked && ["fullB", "fullS", "patB", "patS"].includes(d.key));
    if (gfMode === "muqasama") {
      const units = 2 + sibAsaba.reduce((a, d) => a + d.asabaWeight! * d.count, 0);
      const gfShare = R.isPos() ? R.mulInt(2).divInt(units) : ZERO;
      if (gfShare.gte(SIXTH)) {
        setAsaba(gfD, 2, "asaba_nafs", "يقاسم الإخوة كأخ لأن المقاسمة لا تنقصه عن السدس", "EG77-22");
      } else {
        setFard(gfD, SIXTH, "المقاسمة تنقصه عن السدس فيفرض له السدس", "EG77-22");
      }
    } else {
      if (R.gte(SIXTH)) setAsaba(gfD, 2, "asaba_nafs", "يأخذ الباقي تعصيبًا مع الأخوات صاحبات الفرض", "EG77-22");
      else setFard(gfD, SIXTH, "الباقي أقل من السدس فيفرض له السدس", "EG77-22");
    }
  }

  // Active asaba class: all non-blocked drafts with asabaWeight. Sanity: they must form one class.
  let fardDrafts = all.filter((d) => d.fard && !d.blocked);
  let asabaDrafts = all.filter((d) => d.asabaWeight && !d.blocked);
  let sumF = Fraction.sum(fardDrafts.map((d) => d.fard!));

  // المسألة المشتركة
  const fullBrothersAsaba = fbD && !fbD.blocked && fbD.asabaWeight;
  const matActive = matDrafts.filter((d) => !d.blocked);
  if (fullBrothersAsaba && matN >= 2 && matActive.length && sumF.gte(ONE) && !gfWithSiblings) {
    special.push("المشتركة");
    const mush = [...matActive, fbD!, ...(fsD && !fsD.blocked ? [fsD] : [])];
    const heads = mush.reduce((a, d) => a + d.count, 0);
    for (const d of [fbD!, ...(fsD && !fsD.blocked ? [fsD] : [])]) {
      d.asabaWeight = undefined;
      d.asabaKind = undefined;
    }
    for (const d of mush) {
      d.fard = F(1, 3).mulInt(d.count).divInt(heads);
      d.basis = "mushtaraka";
      d.reason.push("المسألة المشتركة: يشترك الأشقاء مع أولاد الأم في الثلث بالتساوي");
      d.ruleIds.push("EG77-10-2");
    }
    steps.push({
      ruleId: "EG77-10-2",
      text: "استغرقت الفروض التركة فلم يبق للأشقاء شيء، فيشاركون أولاد الأم في الثلث بالتساوي بين الذكور والإناث (المادة 10).",
    });
    fardDrafts = all.filter((d) => d.fard && !d.blocked);
    asabaDrafts = all.filter((d) => d.asabaWeight && !d.blocked);
    sumF = Fraction.sum(fardDrafts.map((d) => d.fard!));
  }

  let base = 1n;
  for (const d of fardDrafts) base = lcm(base, d.fard!.d);
  let awlTo: bigint | undefined;
  let radd = false;
  let residueTo: ShareResult["residueTo"];

  if (sumF.gt(ONE)) {
    awlTo = (sumF.n * base) / sumF.d;
    special.push("العول");
    steps.push({
      ruleId: "EG77-15",
      text: `زادت الفروض على التركة (مجموعها ${sumF.toString()})، فتعول المسألة من ${base} إلى ${awlTo}، ويُقسم بنسبة الفروض.`,
    });
    for (const d of fardDrafts) d.total = d.fard!.div(sumF);
    for (const d of asabaDrafts) d.reason.push("لم يبق له شيء لاستغراق الفروض");
  } else {
    for (const d of fardDrafts) d.total = d.fard!;
    const residue = ONE.sub(sumF);
    if (residue.isPos()) {
      if (asabaDrafts.length) {
        const units = asabaDrafts.reduce((a, d) => a + d.asabaWeight! * d.count, 0);
        if (!fardDrafts.length) base = BigInt(units);
        steps.push({
          ruleId: "EG77-16-18",
          text: `الباقي بعد الفروض ${residue.toString()} للعصبة: ${asabaDrafts
            .map((d) => groupLabel(d.key, d.count))
            .join(" و")}${asabaDrafts.length > 1 || asabaDrafts.some((d) => d.count > 1) ? ` (عدد الرؤوس بالتقدير ${units})` : ""}.`,
        });
        for (const d of asabaDrafts) d.total = d.total.add(residue.mulInt(d.asabaWeight! * d.count).divInt(units));
      } else {
        const spouse = fardDrafts.filter((d) => d.key === "husband" || d.key === "wives");
        const others = fardDrafts.filter((d) => d.key !== "husband" && d.key !== "wives");
        if (others.length) {
          radd = true;
          special.push("الرد");
          const spouseTotal = Fraction.sum(spouse.map((d) => d.fard!));
          const rest = ONE.sub(spouseTotal);
          const S = Fraction.sum(others.map((d) => d.fard!));
          for (const d of others) {
            d.total = rest.mul(d.fard!).div(S);
            d.basis = "fard_radd";
          }
          steps.push({
            ruleId: "EG77-30",
            text: `بقي ${residue.toString()} ولا عصبة نسبية، فيُرد الباقي على أصحاب الفروض${
              spouse.length ? " غير الزوجين" : ""
            } بنسبة فروضهم (المادة 30).`,
          });
        } else if (spouse.length) {
          if (h.distantKin) {
            residueTo = "distantKin";
            issues.push({
              code: "DISTANT_KIN",
              severity: "stop",
              message:
                "يأخذ الزوج/الزوجة فرضه، والباقي لذوي الأرحام وفق المواد 31–38. هذا الإصدار لا يحسب أنصبة ذوي الأرحام.",
              needed: "عرض المسألة على متخصص في الفرائض لتوزيع الباقي على ذوي الأرحام.",
            });
          } else {
            radd = true;
            special.push("الرد على أحد الزوجين");
            for (const d of spouse) {
              d.total = ONE.mul(d.fard!).div(Fraction.sum(spouse.map((x) => x.fard!)));
              d.basis = "fard_radd";
            }
            steps.push({
              ruleId: "EG77-30",
              text: "لا عاصب نسبي ولا صاحب فرض نسبي ولا أحد من ذوي الأرحام، فيُرد الباقي على الزوج/الزوجة (المادة 30).",
            });
          }
        } else if (h.distantKin) {
          residueTo = "distantKin";
          issues.push({
            code: "DISTANT_KIN",
            severity: "stop",
            message: "لا يوجد صاحب فرض ولا عاصب نسبي؛ التركة لذوي الأرحام وفق المواد 31–38، وهذا الإصدار لا يحسب أنصبتهم.",
            needed: "عرض المسألة على متخصص في الفرائض.",
          });
        } else {
          residueTo = "treasury";
          issues.push({
            code: "TREASURY",
            severity: "review",
            message:
              "لا يوجد وارث مدخل. تؤول التركة بعد حق المقر له بالنسب والوصية الزائدة إلى الخزانة العامة (المادة 4). تأكد من عدم وجود أي قريب.",
          });
        }
      }
    } else {
      for (const d of asabaDrafts) d.reason.push("لم يبق له شيء لاستغراق الفروض التركة");
    }
  }

  /* ---------------------------------- output ------------------------------ */
  const groups: GroupShare[] = all
    .sort((a, b) => groupOrder(a.key) - groupOrder(b.key))
    .map((d) => {
      let basis: Basis = d.basis;
      if (!d.blocked && basis !== "mushtaraka" && basis !== "fard_radd") {
        if (d.fard && d.asabaWeight) basis = "fard_asaba";
        else if (d.fard) basis = "fard";
        else if (d.asabaWeight) basis = d.asabaKind!;
      }
      if (basis === "fard_radd" && !d.fard) basis = "fard";
      return {
        key: d.key,
        label: groupLabel(d.key, d.count),
        count: d.count,
        gender: d.gender,
        basis,
        total: d.total,
        fard: d.fard,
        perPerson: d.total.divInt(d.count),
        reason: d.reason.join("؛ "),
        ruleIds: [...new Set(d.ruleIds)],
      };
    });

  let tashih = 1n;
  for (const g of groups) if (g.perPerson.isPos()) tashih = lcm(tashih, g.perPerson.d);

  // invariant: totals sum to 1 unless the residue goes elsewhere
  const sumTotals = Fraction.sum(groups.map((g) => g.total));
  if (!residueTo && groups.length && !sumTotals.eq(ONE)) {
    issues.push({ code: "BALANCE", severity: "stop", message: `خطأ داخلي: مجموع الأنصبة ${sumTotals.toString()} لا يساوي 1.` });
  }

  return { groups, steps, issues, base, awlTo, radd, tashih, special, residueTo };
}
