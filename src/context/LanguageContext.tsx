import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { translations, type Language } from "@/lib/translations";
import { useAuth } from "@/context/AuthContext";
import { setUserLanguage } from "@/lib/db";

type LanguageContextType = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, vars?: Record<string, string>) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem("p4p_lang") as Language | null;
    if (stored) return stored;
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("it")) return "it";
    return "en";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("p4p_lang", l);
    if (user) setUserLanguage(user.uid, l).catch(() => {});
  };

  const t = (key: string, vars?: Record<string, string>): string => {
    const keys = key.split(".");
    for (const source of [translations[lang], translations.en]) {
      let value: unknown = source;
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k];
      }
      if (typeof value === "string") {
        if (!vars) return value;
        return value.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
      }
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
