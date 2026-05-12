import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { signInWithGoogle } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";

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

type Props = {
  message: string;
  onDismiss: () => void;
};

export function LoginModal({ message, onDismiss }: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const handleGoogle = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithGoogle();
      // Success — user state updates in AuthContext, parent will dismiss modal
    } catch {
      setError(t("login.error"));
      setSigningIn(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-3xl border border-border/60 bg-surface p-8 shadow-2xl"
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 text-muted-foreground/50 hover:text-muted-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[9px] uppercase tracking-[0.45em] text-primary/40 text-center">
          people · 4 · people
        </p>

        <p className="mt-5 text-center text-base text-foreground/90 leading-relaxed">
          {message}
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground/60">
          {t("login.freeAndAnonymous") || "Es gratis y anónimo."}
        </p>

        <div className="mt-7 space-y-3">
          <button
            onClick={handleGoogle}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full border border-border/40 bg-surface/60 px-6 py-3.5 text-sm text-foreground/65 hover:text-foreground/90 hover:border-border/70 transition-all disabled:opacity-40"
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
            <p className="text-[11px] text-destructive/60 text-center">{error}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
