import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TROPHY_DEFS } from "@/lib/trophies";

type Props = {
  trophyId: string | null;
  onDismiss: () => void;
};

export function TrophyNotification({ trophyId, onDismiss }: Props) {
  useEffect(() => {
    if (!trophyId) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [trophyId, onDismiss]);

  const def = trophyId ? TROPHY_DEFS[trophyId] : null;

  return (
    <AnimatePresence>
      {def && (
        <motion.div
          key={trophyId}
          initial={{ opacity: 0, y: 80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          onClick={onDismiss}
        >
          <div className="glass rounded-3xl border border-primary/30 shadow-glow overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
            <div className="relative p-5 flex items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", damping: 12, stiffness: 300 }}
                className="text-4xl shrink-0"
              >
                {def.emoji}
              </motion.div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
                  {def.isSecret ? "Trofeo secreto desbloqueado" : "Trofeo desbloqueado"}
                </p>
                <h3 className="mt-0.5 font-display text-xl leading-tight">{def.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{def.description}</p>
              </div>
            </div>
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5, ease: "linear" }}
              style={{ transformOrigin: "left" }}
              className="h-0.5 bg-primary/40"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
