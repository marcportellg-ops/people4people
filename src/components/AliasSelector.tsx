import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { generateAliases } from "@/lib/claude";
import { useUserProfile } from "@/context/UserProfileContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { markOnboarded } from "@/lib/db";
import type { Language } from "@/lib/translations";


const TEXT: Record<Language, {
  eyebrow: string;
  headline: string;
  body: string;
  generate: string;
  saving: string;
  confirm: (alias: string) => string;
  choose: string;
}> = {
  es: {
    eyebrow: "Bienvenido",
    headline: "Elige tu nombre\nen este espacio.",
    body: "Tu identidad aquí es un alias poético. Nadie verá tu nombre real ni tu email. Puedes cambiarlo una vez al mes.",
    generate: "Generar otros",
    saving: "Guardando…",
    confirm: (a) => `Ser ${a}`,
    choose: "Elige uno",
  },
  en: {
    eyebrow: "Welcome",
    headline: "Choose your name\nin this space.",
    body: "Your identity here is a poetic alias. No one will see your real name or email. You can change it once a month.",
    generate: "Generate others",
    saving: "Saving…",
    confirm: (a) => `Be ${a}`,
    choose: "Choose one",
  },
  fr: {
    eyebrow: "Bienvenue",
    headline: "Choisissez votre nom\ndans cet espace.",
    body: "Votre identité ici est un alias poétique. Personne ne verra votre vrai nom ni votre email. Vous pouvez le changer une fois par mois.",
    generate: "Générer d'autres",
    saving: "Sauvegarde…",
    confirm: (a) => `Être ${a}`,
    choose: "Choisissez",
  },
  it: {
    eyebrow: "Benvenuto",
    headline: "Scegli il tuo nome\nin questo spazio.",
    body: "La tua identità qui è un alias poetico. Nessuno vedrà il tuo vero nome o email. Puoi cambiarlo una volta al mese.",
    generate: "Genera altri",
    saving: "Salvataggio…",
    confirm: (a) => `Essere ${a}`,
    choose: "Scegli uno",
  },
};

export function AliasSelector() {
  const { setAlias, setOnboardedTrue } = useUserProfile();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [aliases, setAliases] = useState<string[]>([]);
  const [loadingAliases, setLoadingAliases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const tx = TEXT[lang] ?? TEXT.en;

  const loadAliases = async (l: Language) => {
    setLoadingAliases(true);
    setSelected(null);
    const list = await generateAliases(l).catch(
      () => (ALIAS_FALLBACKS[l] ?? ["Quiet Tide", "Deep Echo", "Late Light", "Still Root", "Calm River"])
    );
    setAliases(list);
    setLoadingAliases(false);
  };

  // Auto-load aliases on mount using the current (browser-detected) language
  useEffect(() => { loadAliases(lang); }, []);

  const confirm = async () => {
    if (!selected || saving) return;
    setSaving(true);
    await setAlias(selected);
    if (user) {
      markOnboarded(user.uid).catch(() => {});
      setOnboardedTrue();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md px-6"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-primary/90 text-center">{tx.eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl text-gradient text-center leading-tight">
          {tx.headline.split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground text-center leading-relaxed">
          {tx.body}
        </p>

        <div className="mt-8 space-y-2.5">
          <AnimatePresence mode="wait">
            {loadingAliases ? (
              <motion.div key="loading" exit={{ opacity: 0 }} className="space-y-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 rounded-2xl bg-surface-elevated/60 animate-pulse" />
                ))}
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5">
                {aliases.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelected(a)}
                    className={`w-full rounded-2xl border px-5 py-3.5 text-left font-display text-lg transition-all ${
                      selected === a
                        ? "border-primary/60 bg-primary/10 text-foreground shadow-glow"
                        : "border-border/60 bg-surface hover:border-primary/30 hover:bg-surface-elevated text-foreground/80"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => loadAliases(lang)}
            disabled={loadingAliases}
            className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingAliases ? "animate-spin" : ""}`} />
            {tx.generate}
          </button>
          <button
            onClick={confirm}
            disabled={!selected || saving}
            className="flex-1 rounded-full bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:scale-[1.01] transition disabled:opacity-40 disabled:scale-100"
          >
            {saving ? tx.saving : selected ? tx.confirm(selected) : tx.choose}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Fallbacks referenced in loadAliases
const ALIAS_FALLBACKS: Record<Language, string[]> = {
  es: ["Voz Serena", "Marea Quieta", "Eco Profundo", "Luz Tardía", "Raíz Firme"],
  en: ["Quiet Tide", "Deep Echo", "Late Light", "Still Root", "Calm River"],
  fr: ["Lumière Douce", "Marée Calme", "Écho Profond", "Racine Ferme", "Voix Sereine"],
  it: ["Luce Serena", "Onda Quieta", "Eco Profondo", "Radice Ferma", "Voce Calma"],
};
