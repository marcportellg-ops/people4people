import { Shield, Lock, Mic2, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const items = [
  { icon: Shield, label: "No direct contact between people" },
  { icon: Lock, label: "Conversations are moderated before delivery" },
  { icon: Mic2, label: "Voices are anonymized before playback" },
  { icon: HeartPulse, label: "Not a substitute for professional support" },
];

export const TrustStrip = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40",
      className,
    )}
  >
    {items.map((it, i) => (
      <motion.div
        key={it.label}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.06, duration: 0.5 }}
        className="bg-surface px-4 py-4 flex items-start gap-3"
      >
        <it.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground leading-relaxed">{it.label}</span>
      </motion.div>
    ))}
  </div>
);

export const TrustBadge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-glass/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground backdrop-blur",
      className,
    )}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
    {children}
  </span>
);
