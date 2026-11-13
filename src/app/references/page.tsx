import { ENGINE_VERSION, RULES, RULESET_DATE, RULESET_VERSION } from "@/engine";
import { SUPPORTED } from "@/content/support";

export const metadata = { title: "المراجع والحالات المدعومة — حساب المواريث الشرعية" };

const STATUS_TXT = { "text-checked": "مطابق للنص المنشور — بانتظار مراجعة متخصص", "specialist-reviewed": "روجع من متخصص", pending: "سياسة تطبيق — بانتظار المراجعة" };

export default function References() {
  return (
    <div style={{ paddingTop: 24 }}>
      <h1>المراجع وسجل القواعد</h1>
      <div className="alert review">
        <span className="ic">⚠</span>
        <div>
          إصدار المحرك {ENGINE_VERSION} · إصدار القواعد {RULESET_VERSION} (تاريخ التحقق {RULESET_DATE.split("-").reverse().join("/")}). «مطابق للنص» يعني أن القاعدة قورنت بنص القانون
          المنشور، لا أنها اعتُمدت شرعيًا أو قانونيًا. الإصدار غير صالح للاعتماد العملي قبل مراجعة متخصص في الفرائض ومحامٍ مصري. مراجعة الحساب برمجيًا (الاختبارات) شيء، ومراجعته
          شرعيًا وقانونيًا شيء آخر.
        </div>
      </div>

      <h2>الحالات المدعومة وغير المدعومة</h2>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="t">
          <thead>
            <tr>
              <th>الحالة</th>
              <th>الوضع</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {SUPPORTED.map((s) => (
              <tr key={s.area}>
                <td>{s.area}</td>
                <td>
                  <span className={`badge ${s.status === "مدعوم" ? "heir" : s.status === "مدعوم مع تنبيه مراجعة" ? "wajiba" : s.status === "خارج النطاق" ? "blocked" : "excluded"}`}>{s.status}</span>
                </td>
                <td className="small">{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>سجل القواعد</h2>
      {Object.values(RULES).map((r) => (
        <div className="card flat" key={r.id} id={r.id}>
          <div className="section-title">
            <h3 style={{ margin: 0 }}>{r.title}</h3>
            <span className="badge neutral">{r.id}</span>
          </div>
          <p>{r.summary}</p>
          <div className="small">
            {r.law && (
              <div>
                <b style={{ display: "inline" }}>النص: </b>
                {r.law}
              </div>
            )}
            {r.shariBasis && (
              <div>
                <b style={{ display: "inline" }}>الأصل الشرعي: </b>
                {r.shariBasis}
              </div>
            )}
            <div>
              <b style={{ display: "inline" }}>الطبيعة: </b>
              {r.nature}
            </div>
            <div>
              <b style={{ display: "inline" }}>المصادر: </b>
              {r.sources.map((s, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </span>
              ))}
            </div>
            <div className="muted">
              تاريخ التحقق {r.verifiedOn.split("-").reverse().join("/")} · {STATUS_TXT[r.status]} · منذ {r.since}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
