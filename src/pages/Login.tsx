import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { signInWithGoogle } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_LABELS, type Language } from "@/lib/translations";
import { cn } from "@/lib/utils";

const LANGS: Language[] = ["en", "es", "it", "fr"];

const COPY: Record<Language, { tagline: string; sub: string; bottom: string }> = {
  es: {
    tagline: "Historias reales.\nConversaciones que llegan.",
    sub: "Hay personas reales detrás de cada historia.",
    bottom: "Una conversación puede cambiar algo.",
  },
  en: {
    tagline: "Real stories.\nConversations that reach.",
    sub: "There are real people behind every story.",
    bottom: "A conversation can change something.",
  },
  fr: {
    tagline: "Des histoires vraies.\nDes conversations qui touchent.",
    sub: "Il y a des personnes réelles derrière chaque histoire.",
    bottom: "Une conversation peut changer quelque chose.",
  },
  it: {
    tagline: "Storie reali.\nConversazioni che arrivano.",
    sub: "Ci sono persone reali dietro ogni storia.",
    bottom: "Una conversazione può cambiare qualcosa.",
  },
};

// Google G icon — inline so no external dependency
function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const Login = () => {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const copy = COPY[lang] ?? COPY.en;

  const handleGoogle = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithGoogle();
      navigate("/gallery");
    } catch {
      setError(t("login.error"));
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background select-none">

      {/* Atmospheric background — pure CSS, no images */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 90% 70% at 50% 38%, hsl(var(--primary) / 0.08), transparent)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 40% at 15% 75%, hsl(218 80% 7% / 0.5), transparent)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 40% 30% at 85% 20%, hsl(270 40% 6% / 0.35), transparent)" }}
        />
      </div>

      {/* Language selector — top-right, very discrete */}
      <div className="absolute top-5 right-5 flex gap-1 flex-wrap justify-end max-w-[200px] z-10">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider transition",
              lang === l
                ? "text-primary/60"
                : "text-muted-foreground/20 hover:text-muted-foreground/45",
            )}
          >
            {LANGUAGE_LABELS[l]}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="w-full max-w-xs px-8 flex flex-col items-center text-center gap-12">

        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <p className="text-[9px] uppercase tracking-[0.45em] text-primary/30">
            people · 4 · people
          </p>
          <h1 className="font-display text-[3.2rem] md:text-[3.8rem] leading-[1.0] tracking-tight text-gradient">
            People<br />4People
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.55, ease: "easeOut" }}
          className="text-sm md:text-base text-muted-foreground/50 leading-relaxed font-light"
        >
          {copy.tagline.split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </motion.p>

        {/* Sign-in button + error */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
          className="w-full space-y-3"
        >
          <button
            onClick={handleGoogle}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full border border-border/30 bg-surface/60 px-6 py-3.5 text-sm text-foreground/55 hover:text-foreground/80 hover:border-border/55 hover:bg-surface/90 transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            {signingIn ? (
              <motion.span
                animate={{ opacity: [0.35, 0.85, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="text-muted-foreground/60"
              >
                {t("login.signingIn")}
              </motion.span>
            ) : (
              <>
                <GoogleIcon />
                {t("login.continueGoogle")}
              </>
            )}
          </button>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-destructive/60 text-center"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Bottom line — very faint atmospheric text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 1.7, ease: "easeOut" }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/18 tracking-[0.18em] whitespace-nowrap"
      >
        {copy.bottom}
      </motion.p>
    </div>
  );
};

export default Login;
