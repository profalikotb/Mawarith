import { GLOSSARY } from "@/content/support";

export const metadata = { title: "المصطلحات — حساب المواريث الشرعية" };

export default function Glossary() {
  return (
    <div style={{ paddingTop: 24 }}>
      <h1>شرح المصطلحات</h1>
      <div className="grid two">
        {GLOSSARY.map((g) => (
          <div key={g.t} className="card flat" id={g.t}>
            <h3>{g.t}</h3>
            <p style={{ margin: 0 }}>{g.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
