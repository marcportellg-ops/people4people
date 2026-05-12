import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { subscribeToPush, isPushSupported } from "@/lib/push";
import { savePushSubscription } from "@/lib/db";

type Props = {
  uid: string;
  role: "helper" | "creator";
  onDone: () => void;
};

export function PushPermissionPrompt({ uid, role, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!isPushSupported() || !visible) return null;

  const message =
    role === "helper"
      ? "¿Quieres saber cuando alguien lee lo que dijiste?"
      : "¿Quieres saber cómo evoluciona tu personaje?";

  const handleAccept = async () => {
    setLoading(true);
    try {
      const sub = await subscribeToPush();
      if (sub) await savePushSubscription(uid, sub.toJSON() as any);
    } catch {}
    setLoading(false);
    setVisible(false);
    onDone();
  };

  const handleDismiss = () => {
    setVisible(false);
    onDone();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="rounded-2xl border border-border/60 bg-surface/95 backdrop-blur-md px-5 py-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-2">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{message}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleAccept}
                    disabled={loading}
                    className="flex-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {loading ? "…" : "Sí, avísame"}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
              <button onClick={handleDismiss} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
