import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { translations, type Language } from "@/lib/translations";

type LanguageContextType = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(
    () => (localStorage.getItem("p4p_lang") as Language) ?? "en",
  );

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("p4p_lang", l);
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    // Try current language first, fall back to English
    for (const source of [translations[lang], translations.en]) {
      let value: unknown = source;
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k];
      }
      if (typeof value === "string") return value;
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
