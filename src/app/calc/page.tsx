"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyCase, evaluateCase, type CaseInput } from "@/engine";
import Step1Meta from "@/components/wizard/Step1Meta";
import Step2Estate from "@/components/wizard/Step2Estate";
import Step3Family from "@/components/wizard/Step3Family";
import Step4Review from "@/components/wizard/Step4Review";
import Results from "@/components/results/Results";
import { Toast } from "@/components/ui";
import { clearDraft, loadDraft, saveCaseVersion, saveDraft } from "@/lib/storage";

const STEPS = ["بيانات المسألة", "التركة والالتزامات", "حصر الأقارب", "المراجعة والتأكيد", "النتائج"];

export default function CalcPage() {
  const [c, setC] = useState<CaseInput>(() => emptyCase());
  const [step, setStep] = useState(0);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setC(d.input);
      setStep(d.step);
      setCaseId(d.caseId);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveDraft({ caseId, step, input: c });
  }, [c, step, caseId, ready]);

  const update = useCallback((fn: (x: CaseInput) => void) => {
    setC((prev) => {
      const n: CaseInput = structuredClone(prev);
      fn(n);
      return n;
    });
  }, []);

  const ev = useMemo(() => (step === 4 ? evaluateCase(c) : null), [c, step]);
  const go = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const canProceed = step !== 0 || c.meta.confirmDeceased;

  const onSave = () => {
    const note = window.prompt("ملاحظة لهذه النسخة (اختياري):") ?? undefined;
    const saved = saveCaseVersion(caseId, c, note || undefined);
    if (saved) {
      setCaseId(saved.id);
      setToast(`حُفظت النسخة رقم ${saved.versions.length} على هذا الجهاز`);
    } else setToast("تعذر الحفظ (قد تكون مساحة التخزين ممتلئة أو معطلة)");
  };

  if (!ready) return <p className="muted">جارٍ التحميل…</p>;

  return (
    <div>
      <div className="section-title" style={{ marginTop: 20 }}>
        <h1 style={{ margin: 0 }}>{c.meta.title?.trim() || "حساب تركة جديدة"}</h1>
        <button
          className="btn ghost sm no-print"
          onClick={() => {
            if (!window.confirm("بدء مسألة جديدة؟ ستُمسح البيانات غير المحفوظة.")) return;
            clearDraft();
            setC(emptyCase());
            setCaseId(null);
            go(0);
          }}
        >
          مسألة جديدة
        </button>
      </div>
      <nav className="stepper" aria-label="خطوات الحساب">
        {STEPS.map((t, i) => (
          <button key={t} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : ""} onClick={() => (i === 0 || c.meta.confirmDeceased ? go(i) : null)}>
            <span className="n">{i < step ? "✓" : i + 1}</span>
            <span className="t">{t}</span>
          </button>
        ))}
      </nav>

      {step === 0 && <Step1Meta c={c} update={update} />}
      {step === 1 && <Step2Estate c={c} update={update} />}
      {step === 2 && <Step3Family c={c} update={update} />}
      {step === 3 && <Step4Review c={c} update={update} />}
      {step === 4 && ev && <Results c={c} ev={ev} onSave={onSave} goTo={go} />}

      <div className={`wizard-nav no-print ${step === 4 ? "static" : ""}`}>
        <button className="btn secondary" disabled={step === 0} onClick={() => go(step - 1)}>
          → السابق
        </button>
        {step < 4 ? (
          <button className="btn primary" disabled={!canProceed} onClick={() => go(step + 1)} title={!canProceed ? "أكد أن المسألة لتركة شخص متوفى" : undefined}>
            {step === 3 ? "احسب الأنصبة" : "التالي ←"}
          </button>
        ) : (
          <button className="btn secondary" onClick={() => go(2)}>
            تعديل الأقارب
          </button>
        )}
      </div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </div>
  );
}
