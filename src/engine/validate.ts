import type { CaseInput, Descendant, Issue } from "./types";

const today = () => new Date().toISOString().slice(0, 10);

/** Data-integrity checks and special-situation flags. */
export function validateCase(c: CaseInput, todayIso = today()): Issue[] {
  const out: Issue[] = [];
  const m = c.meta;
  if (!m.confirmDeceased)
    out.push({ code: "NOT_CONFIRMED", severity: "stop", message: "لم يُؤكَّد أن المسألة لتركة شخص متوفى.", needed: "أكد وفاة المورث (أو صدور حكم باعتباره ميتًا)." });
  if (!m.deceasedIsMuslim)
    out.push({
      code: "NON_MUSLIM",
      severity: "stop",
      message: "هذا الإطار مخصص لتركات المسلمين وفق القانون المصري؛ تركات غير المسلمين قد تخضع لأحكام أخرى.",
      needed: "مراجعة محامٍ مختص.",
    });
  if (m.deathDate && m.deathDate > todayIso)
    out.push({ code: "DEATH_FUTURE", severity: "stop", message: "تاريخ الوفاة المدخل في المستقبل.", needed: "صحح تاريخ الوفاة." });

  // descendants: dates vs. status, duplicates
  const names = new Map<string, number>();
  const note = (n?: string) => {
    const k = (n || "").trim();
    if (k) names.set(k, (names.get(k) || 0) + 1);
  };
  const walk = (d: Descendant) => {
    note(d.name);
    if (m.deathDate && d.deathDate) {
      if (d.status === "predeceased" && d.deathDate > m.deathDate)
        out.push({ code: "DATE_CONFLICT", severity: "stop", message: `«${d.name || "فرع"}»: مسجل أنه توفي قبل المورث لكن تاريخ وفاته بعد تاريخ وفاة المورث.` });
      if (d.status === "died_after" && d.deathDate < m.deathDate)
        out.push({ code: "DATE_CONFLICT", severity: "stop", message: `«${d.name || "فرع"}»: مسجل أنه توفي بعد المورث لكن تاريخ وفاته قبل تاريخ وفاة المورث.` });
      if (d.status === "alive" && d.deathDate && d.deathDate < m.deathDate)
        out.push({ code: "DATE_CONFLICT", severity: "stop", message: `«${d.name || "فرع"}»: مسجل حيًا وقت الوفاة ومعه تاريخ وفاة سابق.` });
      if (d.status === "simultaneous" && d.deathDate !== m.deathDate)
        out.push({ code: "DATE_CHECK", severity: "info", message: `«${d.name || "فرع"}»: مسجل أنه توفي مع المورث وتاريخه مختلف؛ تأكد من البيانات.` });
    }
    if (d.status === "predeceased" || d.status === "simultaneous") {
      // nothing
    }
    d.children.forEach(walk);
  };
  c.family.children.forEach(walk);
  const f = c.family;
  [f.husband.name, f.father.name, f.mother.name, f.paternalGrandfather.name, ...f.wives.list.map((w) => w.name)].forEach(note);
  for (const g of [
    f.fullBrothers,
    f.fullSisters,
    f.patBrothers,
    f.patSisters,
    f.matBrothers,
    f.matSisters,
    f.fullNephews,
    f.patNephews,
    f.fullUncles,
    f.patUncles,
    f.fullCousins,
    f.patCousins,
  ])
    (g.names || []).forEach(note);
  for (const [n, k] of names)
    if (k > 1)
      out.push({
        code: "DUP_NAME",
        severity: "review",
        message: `الاسم «${n}» مكرر ${k} مرات؛ تأكد أنه ليس الشخص نفسه مضافًا بقرابتين.`,
      });

  if (m.deceasedGender === "male" && f.husband.state === "yes")
    out.push({ code: "SPOUSE_GENDER", severity: "stop", message: "المتوفى ذكر ولا يُتصور أن يكون له زوج." });
  if (m.deceasedGender === "female" && f.wives.state === "yes")
    out.push({ code: "SPOUSE_GENDER", severity: "stop", message: "المتوفاة أنثى ولا يُتصور أن يكون لها زوجة." });

  if (f.paternalGrandfather.state === "yes" && f.father.state === "yes")
    out.push({ code: "GF_WITH_F", severity: "info", message: "الجد محجوب بالأب؛ أُدخل للبيان فقط." });

  // other relative confirmation
  if (f.otherRelative === "yes")
    out.push({ code: "OTHER_RELATIVE", severity: "stop", message: "أفدتَ بوجود قريب آخر لم يُضف وقد يؤثر في القسمة.", needed: "أضف هذا القريب في فئته الصحيحة." });
  if (f.otherRelative === "unknown")
    out.push({ code: "OTHER_RELATIVE_UNKNOWN", severity: "review", message: "لم يُؤكَّد عدم وجود أقارب آخرين مؤثرين؛ النتيجة مبدئية." });

  // flags
  const fl = c.flags;
  const add = (cond: boolean, i: Issue) => cond && out.push(i);
  add(fl.pregnancy === "yes" && fl.pregnancyRelation === "other", {
    code: "PREGNANCY_OTHER",
    severity: "stop",
    message: "يوجد حمل قد يرث (من غير المتوفى نفسه، كحمل الأم أو زوجة الابن)؛ يلزم إيقاف نصيب له وتقدير الاحتمالات.",
    needed: "عرض المسألة على متخصص، أو الانتظار حتى الولادة.",
  });
  add(fl.pregnancy === "yes" && fl.pregnancyRelation === "decedent_child", {
    code: "PREGNANCY",
    severity: "review",
    message: "يوجد حمل من المتوفى: يوقف له أوفر النصيبين على تقدير الذكورة أو الأنوثة، ويُعطى الآخرون أقل النصيبين حتى الولادة (المادة 42). انظر جدول «الحمل» أدناه. تعدد الحمل (توائم) يحتاج مراجعة.",
  });
  add(fl.pregnancy === "unknown", { code: "PREGNANCY_UNKNOWN", severity: "review", message: "لم يُحسم وجود حمل قد يرث؛ النتيجة مبدئية." });
  add(fl.missingPerson === "yes", {
    code: "MISSING",
    severity: "stop",
    message: "يوجد مفقود أو مجهول الحياة وقت الوفاة؛ يوقف نصيبه حتى يتبين حاله أو يُحكم بموته (المادة 45).",
    needed: "بيان حاله أو حكم قضائي، ثم إعادة الحساب.",
  });
  add(fl.simultaneousDeath === "yes", {
    code: "SIMULTANEOUS",
    severity: "review",
    message: "توجد وفاة متزامنة أو ترتيب وفيات غير معلوم: من لم يُعلم أيهما مات أولًا لا يرث أحدهما الآخر (المادة 3). سجّل حالته «توفي معه» أو استبعده من الورثة.",
  });
  add(fl.nasabDispute === "yes", { code: "NASAB_DISPUTE", severity: "review", message: "يوجد نزاع في النسب؛ الحساب مبدئي مشروط بثبوت النسب كما أُدخل." });
  add(fl.marriageDispute === "yes", { code: "MARRIAGE_DISPUTE", severity: "review", message: "يوجد نزاع في الزوجية؛ الحساب مبدئي مشروط بثبوتها." });
  add(fl.divorceIssue === "yes", { code: "DIVORCE", severity: "review", message: "يوجد طلاق قد يؤثر في الاستحقاق؛ تأكد من نوعه وحال العدة وقت الوفاة." });
  add(fl.impediment === "yes", {
    code: "IMPEDIMENT",
    severity: "review",
    message: "يحتمل وجود مانع إرث (قتل عمد، اختلاف دين). من ثبت منعه يُستبعد من الإدخال ولا يحجب غيره (المادتان 5–6).",
  });
  add(fl.minors === "yes", {
    code: "MINORS",
    severity: "info",
    message: "يوجد قاصر أو ناقص أهلية بين المستحقين: لا تُعتبر إجازته للوصايا ولا تخارجه إلا وفق إجراءات الولاية على المال.",
  });
  add(fl.disputedWill === "yes", { code: "WILL_DISPUTED", severity: "review", message: "توجد وصية متنازع عليها؛ النتيجة مبدئية حتى الفصل فيها." });
  add(fl.foreignAssets === "yes", { code: "FOREIGN", severity: "review", message: "توجد أصول قد تخضع لأكثر من نظام قانوني؛ راجع محاميًا بشأن القانون الواجب التطبيق." });
  add(fl.generalDispute === "yes", { code: "DISPUTE", severity: "review", message: "أُفيد بوجود نزاع أو معلومات غير مؤكدة؛ النتيجة مبدئية." });
  add(fl.generalDispute === "unknown", { code: "DISPUTE_UNKNOWN", severity: "info", message: "لم يُحدد وجود نزاع؛ افترض الحساب صحة البيانات المدخلة." });

  return out;
}
