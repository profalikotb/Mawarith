import { writeFileSync } from "node:fs";
import { RULES, ENGINE_VERSION, RULESET_VERSION, RULESET_DATE } from "../src/engine/rules";
import { SUPPORTED } from "../src/content/support";
const sup = [`# الحالات المدعومة وغير المدعومة`, ``, `إصدار المحرك ${ENGINE_VERSION} · إصدار القواعد ${RULESET_VERSION} · ${RULESET_DATE}`, ``, `| الحالة | الوضع | ملاحظة |`, `|---|---|---|`, ...SUPPORTED.map((s) => `| ${s.area} | ${s.status} | ${s.note} |`)].join("\n");
writeFileSync("docs/SUPPORTED-CASES.md", sup + "\n");
const refs = [
  `# سجل المراجع وإصدارات القواعد`, ``,
  `- إصدار المحرك: **${ENGINE_VERSION}**`, `- إصدار القواعد: **${RULESET_VERSION}** (تاريخ التحقق ${RULESET_DATE})`,
  `- حالة \`text-checked\`: قورنت القاعدة بنص القانون المنشور فقط — **ليست** مراجعة شرعية أو قانونية معتمدة.`, ``,
  `| المعرف | القاعدة | النص القانوني | الطبيعة | التحقق | الحالة |`, `|---|---|---|---|---|---|`,
  ...Object.values(RULES).map((r) => `| ${r.id} | ${r.title} | ${r.law ?? "—"} | ${r.nature} | ${r.verifiedOn} | ${r.status} |`),
  ``, `## المصادر`, ``,
  ...[...new Map(Object.values(RULES).flatMap((r) => r.sources).filter((s) => s.url).map((s) => [s.url, s])).values()].map((s) => `- [${s.label}](${s.url})`),
  `- فتاوى دار الإفتاء المصرية المستخدمة في الاختبارات المرجعية: رقم 3228 (1981)، ورقم 219 و520 (1955)، ورقم 526 (1957) — [أرشيف الفتاوى](https://archive.org/download/ftawi_misr/23.pdf)`,
  ``, `## سجل الإصدارات`, ``, `- ${RULESET_VERSION} (${RULESET_DATE}): الإصدار الأول.`,
].join("\n");
writeFileSync("docs/REFERENCES.md", refs + "\n");
console.log("docs generated");
