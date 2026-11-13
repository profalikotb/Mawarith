"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickText from "@/components/QuickText";
import { clearDraft } from "@/lib/storage";

const FEATURES = [
  { ic: "⚖", t: "محرك قواعد موثق", d: "كل نتيجة مرتبطة بمادة القانون أو الأصل الشرعي، مع إصدار القواعد وتاريخ التحقق." },
  { ic: "½", t: "كسور دقيقة", d: "حساب بكسور صحيحة دون أعداد عشرية، مع توزيع القروش دون ضياع أو زيادة." },
  { ic: "◆", t: "الوصية الواجبة", d: "حساب افتراضي لنصيب الولد المتوفى، ثم الرد إلى الثلث والتوزيع على الفروع." },
  { ic: "⛔", t: "لا قسمة تخمينية", d: "الحالات غير المدعومة أو غير المحسومة تُوقف النتيجة وتبين المطلوب." },
  { ic: "✎", t: "شرح خطوة بخطوة", d: "لماذا ورث كل شخص أو حُجب، مع الفروض والعول والرد." },
  { ic: "⇩", t: "تقرير A4 وExcel", d: "تقرير عربي قابل للطباعة والبحث، وملف Excel منظم." },
];

export default function Home() {
  const router = useRouter();
  return (
    <>
      <section className="hero">
        <span className="pill">الإطار القانوني المصري للمسلمين — ق 77 لسنة 1943 وق 71 لسنة 1946</span>
        <h1 style={{ marginTop: 14 }}>حساب المواريث الشرعية</h1>
        <p className="lead">
          احسب توزيع التركة وافهمه: الالتزامات، والوصايا، وأنصبة الورثة، وأسباب الحجب، مع بيان الحالات التي تحتاج إلى متخصص.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <button
            className="btn primary big"
            onClick={() => {
              clearDraft();
              router.push("/calc");
            }}
          >
            ابدأ حساب تركة جديدة
          </button>
          <Link className="btn secondary big" href="/guide">
            كيف يعمل؟
          </Link>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          حساب سريع دون تسجيل؛ لا يُحفظ شيء إلا إذا طلبت ذلك.
        </p>
      </section>

      <div className="grid three" style={{ marginBottom: 20 }}>
        {FEATURES.map((f) => (
          <div className="feature" key={f.t}>
            <div className="ic" aria-hidden>
              {f.ic}
            </div>
            <h3 style={{ margin: "6px 0" }}>{f.t}</h3>
            <p className="small muted" style={{ margin: 0 }}>
              {f.d}
            </p>
          </div>
        ))}
      </div>

      <QuickText />

      <div className="alert info">
        <span className="ic">ℹ</span>
        <div>
          هذا التطبيق أداة حسابية تعليمية، <b style={{ display: "inline" }}>غير معتمد</b> من الأزهر أو دار الإفتاء أو أي جهة رسمية. قواعده مبنية على نصوص القانونين المنشورة وتطبيقات دار
          الإفتاء المصرية، وهي بانتظار مراجعة متخصص في الفرائض ومحامٍ مصري. <Link href="/references">اطلع على المراجع والحالات المدعومة</Link>.
        </div>
      </div>
    </>
  );
}
