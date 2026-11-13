"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSettings } from "@/lib/settings";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/calc", label: "حساب تركة" },
  { href: "/cases", label: "مسائلي المحفوظة" },
  { href: "/glossary", label: "المصطلحات" },
  { href: "/guide", label: "دليل الاستخدام" },
  { href: "/references", label: "المراجع والحالات المدعومة" },
];

export default function Header() {
  const path = usePathname();
  const { theme, setTheme, digits, setDigits } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar no-print">
      <div className="container inner">
        <Link href="/" className="brand" aria-label="حساب المواريث الشرعية — الرئيسية">
          <span className="mark" aria-hidden>
            ⚖
          </span>
          <span>حساب المواريث الشرعية</span>
        </Link>
        <nav className={`nav ${open ? "open" : ""}`} aria-label="التنقل الرئيسي">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="tools">
          <button
            className="icon-btn"
            onClick={() => setDigits(digits === "ar" ? "en" : "ar")}
            title="تبديل الأرقام العربية/الإنجليزية"
            aria-label="تبديل نوع الأرقام"
          >
            {digits === "ar" ? "١٢٣" : "123"}
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
            title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="icon-btn menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="القائمة">
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
