"use client";
import { basisText, RULES, type CaseInput, type CaseResult } from "@/engine";
import { fmtDate, fmtDateTime } from "./format";

const ROLE: Record<string, string> = {
  heir: "وارث",
  blocked: "محجوب",
  excluded: "غير وارث",
  wajiba: "وصية واجبة",
  will: "وصية اختيارية",
  treasury: "الخزانة العامة",
};

const egp = (p?: bigint) => (p === undefined ? null : Number(p) / 100); // display cell only; exact piasters kept in a separate column

export async function exportExcel(c: CaseInput, r: CaseResult) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "حساب المواريث الشرعية";
  wb.created = new Date();
  const head = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0E6B4F" } } };
  const mk = (name: string) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    return ws;
  };
  const styleHeader = (ws: import("exceljs").Worksheet) => {
    ws.getRow(1).eachCell((cell) => {
      cell.font = head.font;
      cell.fill = head.fill;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    ws.getRow(1).height = 28;
  };

  /* summary */
  const s = mk("الملخص");
  s.columns = [
    { header: "البند", key: "k", width: 36 },
    { header: "القيمة", key: "v", width: 60 },
  ];
  const statusText = { final: "حساب مكتمل وفق البيانات", preliminary: "حساب مبدئي يحتاج مراجعة", stopped: "متوقف — يحتاج مراجعة متخصص", incomplete: "بيانات ناقصة مؤثرة" }[r.status];
  [
    ["اسم المسألة", c.meta.title || "—"],
    ["جنس المتوفى", c.meta.deceasedGender === "male" ? "ذكر" : "أنثى"],
    ["تاريخ الوفاة", fmtDate(c.meta.deathDate, "en")],
    ["الإطار القانوني", "الإطار المصري للمسلمين — ق 77/1943 وق 71/1946"],
    ["حالة الحساب", statusText],
    ["تاريخ الحساب", fmtDateTime(r.computedAt, "en")],
    ["إصدار المحرك", r.engineVersion],
    ["إصدار القواعد", r.rulesetVersion],
    ["أصل المسألة", r.shares.base.toString()],
    ["العول", r.shares.awlTo ? `عالت إلى ${r.shares.awlTo}` : "لا"],
    ["الرد", r.shares.radd ? "نعم" : "لا"],
    ["مجموع أسهم صافي التركة", r.tashihNet.toString()],
    ["اتزان التوزيع", r.balanceOk ? "متزن" : "غير متزن"],
    ["تنبيه", "نتيجة حسابية مبنية على البيانات المدخلة؛ لا تُعد إعلام وراثة أو حكمًا قضائيًا أو فتوى شخصية معتمدة."],
  ].forEach(([k, v]) => s.addRow({ k, v }));
  styleHeader(s);
  s.getColumn("v").alignment = { wrapText: true };

  /* shares */
  const t = mk("الاستحقاقات");
  t.columns = [
    { header: "المستحق", key: "name", width: 24 },
    { header: "الصلة", key: "rel", width: 22 },
    { header: "الحالة", key: "role", width: 14 },
    { header: "الأساس", key: "basis", width: 18 },
    { header: "السبب", key: "reason", width: 50 },
    { header: "النصيب الشرعي (كسر)", key: "pool", width: 16 },
    { header: "من صافي التركة (كسر)", key: "net", width: 16 },
    { header: "النسبة %", key: "pct", width: 10 },
    { header: "الأسهم", key: "sahm", width: 12 },
    { header: "القيمة (ج.م)", key: "egp", width: 16 },
    { header: "القيمة بالقروش (دقيقة)", key: "pi", width: 20 },
    { header: "المرجع", key: "ref", width: 40 },
  ];
  for (const p of r.persons) {
    t.addRow({
      name: p.name || p.relation,
      rel: p.relation,
      role: ROLE[p.role],
      basis: basisText(p.basis),
      reason: p.reason,
      pool: p.shareOfPool?.toString() ?? "",
      net: p.shareOfNet.toString(),
      pct: Number(p.shareOfNet.toPercent(4)),
      sahm: p.sahmNet ? p.sahmNet.toString() : "",
      egp: egp(p.amount),
      pi: p.amount !== undefined ? p.amount.toString() : "",
      ref: p.ruleIds.map((id) => RULES[id]?.law ?? id).join(" | "),
    });
  }
  t.getColumn("egp").numFmt = "#,##0.00";
  t.getColumn("pct").numFmt = "0.00";
  t.getColumn("reason").alignment = { wrapText: true, vertical: "top" };
  t.getColumn("ref").alignment = { wrapText: true, vertical: "top" };
  styleHeader(t);
  t.autoFilter = { from: "A1", to: "L1" };

  /* estate */
  const e = mk("التركة");
  e.columns = [
    { header: "البند", key: "k", width: 40 },
    { header: "القيمة (ج.م)", key: "v", width: 18 },
    { header: "ملاحظة", key: "n", width: 40 },
  ];
  if (!c.estate.fractionOnly) {
    for (const a of r.estate.assetLines) e.addRow({ k: a.label || a.kind, v: egp(a.included), n: `القيمة الكاملة ${egp(a.full)} × حصة ${a.ownership}` });
    e.addRow({ k: "ديون مستحقة للمتوفى (محتسبة)", v: egp(r.estate.receivablesIncluded) });
    e.addRow({ k: "إجمالي التركة", v: egp(r.estate.totalEstate) });
    e.addRow({ k: "تجهيز ودفن", v: egp(-r.estate.funeral) });
    e.addRow({ k: "ديون ثابتة", v: egp(-r.estate.debtsProven) });
    for (const d of r.estate.debtsExcluded) e.addRow({ k: `غير محتسب: ${d.label}`, v: egp(d.amount), n: d.why });
    e.addRow({ k: "الصافي قبل الوصايا", v: egp(r.estate.netBeforeWills) });
    e.addRow({ k: "حقوق محتملة غير محتسبة", v: egp(r.estate.receivablesDoubtful) });
  } else e.addRow({ k: "وضع الكسور فقط — لا قيم مالية" });
  e.addRow({ k: "الوصية الواجبة (كسر من الصافي)", n: r.wajiba.total.toString() });
  e.addRow({ k: "الوصايا الاختيارية النافذة (كسر)", n: r.wills.executedTotal.toString() });
  e.addRow({ k: "نصيب الورثة (كسر)", n: r.pool.toString() });
  e.getColumn("v").numFmt = "#,##0.00";
  styleHeader(e);

  /* steps */
  const st = mk("خطوات الحساب");
  st.columns = [
    { header: "#", key: "i", width: 6 },
    { header: "الخطوة", key: "t", width: 90 },
    { header: "المرجع", key: "r", width: 40 },
  ];
  r.steps.forEach((x, i) => st.addRow({ i: i + 1, t: x.text, r: x.ruleId ? RULES[x.ruleId]?.law ?? RULES[x.ruleId]?.title ?? x.ruleId : "" }));
  st.getColumn("t").alignment = { wrapText: true, vertical: "top" };
  styleHeader(st);

  /* issues */
  const is = mk("ملاحظات وحالات");
  is.columns = [
    { header: "الدرجة", key: "s", width: 16 },
    { header: "الملاحظة", key: "m", width: 90 },
    { header: "المطلوب", key: "n", width: 40 },
  ];
  const sev = { stop: "يوقف الحساب", review: "يحتاج مراجعة", info: "ملاحظة" };
  r.issues.forEach((x) => is.addRow({ s: sev[x.severity], m: x.message, n: x.needed ?? "" }));
  r.unknowns.forEach((u) => is.addRow({ s: "غير محسوم", m: u.question }));
  is.getColumn("m").alignment = { wrapText: true, vertical: "top" };
  styleHeader(is);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `مواريث-${(c.meta.title || "مسألة").replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
