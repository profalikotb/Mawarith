import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "حساب المواريث الشرعية",
  description: "حساب توزيع التركة وفق أحكام المواريث الإسلامية والإطار القانوني المصري للمسلمين، مع شرح خطوة بخطوة ومراجع كل قاعدة.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e6b4f" },
    { media: "(prefers-color-scheme: dark)", color: "#0c131d" },
  ],
};

const themeBoot = `try{var t=localStorage.getItem("mw:theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <SettingsProvider>
          <Header />
          <main className="container">{children}</main>
          <footer className="container disclaimer no-print">
            <p>
              <b>تنبيه:</b> نتيجة حسابية مبنية على البيانات المدخلة؛ لا تُعد إعلام وراثة أو حكمًا قضائيًا أو فتوى شخصية معتمدة.
              التطبيق غير معتمد من الأزهر الشريف أو دار الإفتاء المصرية أو أي جهة رسمية، وقواعده بانتظار مراجعة متخصص في الفرائض ومحامٍ مصري.
            </p>
            <p className="small">
              الحساب يتم داخل جهازك؛ لا تُرسل بيانات المسألة إلى أي خادم إلا إذا فعّلت الحفظ السحابي بنفسك.
            </p>
          </footer>
        </SettingsProvider>
      </body>
    </html>
  );
}
