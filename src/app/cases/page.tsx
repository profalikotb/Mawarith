"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { calculateCase, type CaseInput } from "@/engine";
import { Card, Toast } from "@/components/ui";
import { cloudEnabled, currentUser, deleteCloudCase, exportCloudData, listCloudCases, loadLatestCloudVersion, saveCloudVersion, signInWithEmail, signOut, type CloudCase } from "@/lib/cloud";
import { fmtDateTime } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { deleteAllCases, deleteCase, diffSummary, listCases, saveDraft, type SavedCase } from "@/lib/storage";

export default function CasesPage() {
  const [list, setList] = useState<SavedCase[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { digits } = useSettings();
  const router = useRouter();
  const refresh = () => setList(listCases());
  useEffect(refresh, []);

  const openVersion = (id: string, input: CaseInput) => {
    saveDraft({ caseId: id, step: 4, input });
    router.push("/calc");
  };

  return (
    <div style={{ paddingTop: 24 }}>
      <h1>مسائلي المحفوظة</h1>
      <p className="muted">محفوظة على هذا الجهاز فقط. كل نسخة تحفظ البيانات وإصدار القواعد المستخدم.</p>
      {list.length === 0 && <p>لا توجد مسائل محفوظة.</p>}
      {list.map((c) => {
        const last = c.versions[c.versions.length - 1];
        const st = calculateCase(last.input).status;
        return (
          <Card
            key={c.id}
            title={c.title}
            actions={
              <div className="row">
                <button className="btn primary sm" onClick={() => openVersion(c.id, last.input)}>
                  فتح آخر نسخة
                </button>
                <button className="btn secondary sm" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  سجل التغييرات ({c.versions.length})
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${c.title}.json`;
                    a.click();
                  }}
                >
                  تصدير
                </button>
                <button
                  className="btn danger sm"
                  onClick={() => {
                    if (window.confirm(`حذف «${c.title}» وجميع نسخها نهائيًا؟`)) {
                      deleteCase(c.id);
                      refresh();
                    }
                  }}
                >
                  حذف
                </button>
              </div>
            }
          >
            <p className="small muted">
              آخر تعديل: {fmtDateTime(c.updatedAt, digits)} · الحالة: {st === "final" ? "مكتمل" : st === "preliminary" ? "مبدئي" : st === "stopped" ? "متوقف" : "ناقص"}
            </p>
            {open === c.id && (
              <ol className="steplist">
                {c.versions.map((v, i) => {
                  const diff = i > 0 ? diffSummary(c.versions[i - 1].input, v.input) : [];
                  return (
                    <li key={v.at}>
                      {fmtDateTime(v.at, digits)} — القواعد {v.rulesetVersion} / المحرك {v.engineVersion}
                      {v.note && <span> — «{v.note}»</span>}
                      {i > 0 && <div className="ref">تغيّر: {diff.length ? diff.slice(0, 6).join("، ") + (diff.length > 6 ? "…" : "") : "لا شيء"}</div>}
                      <button className="btn ghost sm" onClick={() => openVersion(c.id, v.input)}>
                        فتح هذه النسخة
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        );
      })}
      {list.length > 0 && (
        <button
          className="btn danger"
          onClick={() => {
            if (window.confirm("حذف جميع المسائل المحفوظة على هذا الجهاز؟")) {
              deleteAllCases();
              refresh();
            }
          }}
        >
          حذف كل البيانات المحلية
        </button>
      )}
      <CloudSection onToast={setToast} local={list} />
      <Toast msg={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function CloudSection({ onToast, local }: { onToast: (s: string) => void; local: SavedCase[] }) {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [email, setEmail] = useState("");
  const [cases, setCases] = useState<CloudCase[]>([]);
  const router = useRouter();
  const enabled = cloudEnabled();
  useEffect(() => {
    if (!enabled) return;
    currentUser().then((u) => {
      setUser(u);
      if (u) listCloudCases().then(setCases).catch(() => onToast("تعذر تحميل المسائل السحابية"));
    });
  }, [enabled, onToast]);
  if (!enabled)
    return (
      <Card title="الحفظ السحابي" icon="☁">
        <p className="small muted">غير مفعّل في هذا النشر. يمكن لمدير التطبيق تفعيله بربط Supabase (انظر README). البيانات حينها معزولة لكل مستخدم بسياسات أمان على مستوى الصف.</p>
      </Card>
    );
  return (
    <Card title="الحفظ السحابي (اختياري)" icon="☁">
      {!user ? (
        <div className="row">
          <input type="email" className="ltr" style={{ maxWidth: 320 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" aria-label="البريد الإلكتروني" />
          <button
            className="btn primary"
            onClick={() =>
              signInWithEmail(email)
                .then(() => onToast("أُرسل رابط الدخول إلى بريدك"))
                .catch(() => onToast("تعذر إرسال رابط الدخول"))
            }
          >
            دخول برابط على البريد
          </button>
        </div>
      ) : (
        <>
          <p className="small">مسجل باسم {user.email}</p>
          <div className="row">
            {local.map((c) => (
              <button
                key={c.id}
                className="btn secondary sm"
                onClick={() =>
                  saveCloudVersion(null, c.versions[c.versions.length - 1].input)
                    .then(() => listCloudCases().then(setCases))
                    .then(() => onToast("رُفعت النسخة"))
                    .catch(() => onToast("تعذر الرفع"))
                }
              >
                رفع «{c.title}»
              </button>
            ))}
          </div>
          <ul>
            {cases.map((c) => (
              <li key={c.id}>
                {c.title}{" "}
                <button
                  className="btn ghost sm"
                  onClick={async () => {
                    const input = await loadLatestCloudVersion(c.id);
                    if (input) {
                      saveDraft({ caseId: null, step: 4, input });
                      router.push("/calc");
                    }
                  }}
                >
                  فتح
                </button>
                <button
                  className="btn danger sm"
                  onClick={async () => {
                    if (!window.confirm("حذف هذه المسألة من السحابة؟")) return;
                    await deleteCloudCase(c.id);
                    setCases(await listCloudCases());
                  }}
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <button
              className="btn ghost sm"
              onClick={async () => {
                const d = await exportCloudData();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
                a.download = "mawareeth-cloud-export.json";
                a.click();
              }}
            >
              تصدير بياناتي السحابية
            </button>
            <button className="btn secondary sm" onClick={() => signOut().then(() => setUser(null))}>
              خروج
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
