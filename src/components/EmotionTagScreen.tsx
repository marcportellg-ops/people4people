import { useState } from "react";
import { motion } from "framer-motion";
import { saveEmotionTags } from "@/lib/db";

const TAG_CATEGORIES = [
  {
    label: "Intensidad emocional",
    tags: ["Devastadora", "Agotadora", "Removedora", "Pesada", "Tranquila"],
  },
  {
    label: "Conexión",
    tags: ["Íntima", "Honesta", "Difícil", "Fluida", "Sorprendente"],
  },
  {
    label: "Lo que te dejó",
    tags: ["Pensativa", "Esperanzadora", "Inquietante", "Sanadora", "Incompleta"],
  },
  {
    label: "Lo inesperado",
    tags: ["Inesperada", "Compleja", "Extraña", "Luminosa", "Oscura"],
  },
];

type Props = {
  conversationId: string | null;
  characterId: string;
  onDone: () => void;
};

export const EmotionTagScreen = ({ conversationId, characterId, onDone }: Props) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (tag: string) => {
    setSelected((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 2) return prev;
      return [...prev, tag];
    });
  };

  const handleSave = async () => {
    const tags = [...selected];
    const trimmed = custom.trim();
    if (trimmed) tags.push(trimmed);
    if (conversationId && tags.length > 0) {
      setSaving(true);
      try {
        await saveEmotionTags(conversationId, tags, characterId);
      } catch {
        // non-critical
      }
    }
    onDone();
  };

  const canSave = selected.length > 0 || custom.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg glass-strong rounded-3xl p-8 space-y-6 my-auto"
      >
        <div>
          <h2 className="font-display text-2xl">¿Cómo describirías esta conversación en una palabra?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Elige hasta dos. Tu respuesta ayuda a otros helpers a encontrar a quien necesitan.
          </p>
        </div>

        <div className="space-y-4">
          {TAG_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 mb-2">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.tags.map((tag) => {
                  const active = selected.includes(tag);
                  const disabled = selected.length >= 2 && !active;
                  return (
                    <button
                      key={tag}
                      onClick={() => toggle(tag)}
                      disabled={disabled}
                      className={`rounded-full px-3 py-1.5 text-xs border transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : disabled
                          ? "border-border/30 text-muted-foreground/30 cursor-not-allowed"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 mb-2">
            O escribe la tuya propia
          </p>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 20))}
            placeholder="Una palabra…"
            className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onDone}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            Saltar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="rounded-full bg-gradient-amber text-primary-foreground px-6 py-2.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
