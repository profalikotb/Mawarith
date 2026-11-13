"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Digits } from "./format";

interface Settings {
  theme: "light" | "dark";
  digits: Digits;
  setTheme: (t: "light" | "dark") => void;
  setDigits: (d: Digits) => void;
}

const Ctx = createContext<Settings>({ theme: "light", digits: "ar", setTheme: () => {}, setDigits: () => {} });

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<"light" | "dark">("light");
  const [digits, setDigitsS] = useState<Digits>("ar");
  useEffect(() => {
    const t = read("mw:theme");
    const d = read("mw:digits");
    if (t === "dark" || t === "light") setThemeS(t);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setThemeS("dark");
    if (d === "en" || d === "ar") setDigitsS(d);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <Ctx.Provider
      value={{
        theme,
        digits,
        setTheme: (t) => {
          setThemeS(t);
          write("mw:theme", t);
        },
        setDigits: (d) => {
          setDigitsS(d);
          write("mw:digits", d);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);
