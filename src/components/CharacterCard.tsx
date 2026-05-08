import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Character } from "@/data/characters";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export const CharacterCard = ({ character, index = 0 }: { character: Character; index?: number }) => {
  const [hovered, setHovered] = useState(false);
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: (index % 8) * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={`/talk/${character.id}`}
        className="block relative overflow-hidden rounded-2xl bg-surface aspect-[3/4] shadow-elevated"
      >
        {/* Portrait */}
        <motion.img
          src={character.portrait}
          alt={`${character.name}, ${character.age}`}
          loading="lazy"
          animate={{ scale: hovered ? 1.07 : 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-portrait" />

        {/* Darken on hover */}
        <motion.div
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 bg-background/55"
        />

        {/* Tags — top left */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 z-10">
          {character.tags.slice(0, 2).map((tg) => (
            <span
              key={tg}
              className="rounded-full bg-background/40 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80 border border-border/40"
            >
              {t(`tags.${tg}`)}
            </span>
          ))}
        </div>

        {/* Default bottom info — fades out on hover */}
        <motion.div
          animate={{ opacity: hovered ? 0 : 1, y: hovered ? 8 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-0 inset-x-0 p-5 z-10"
        >
          <div className="flex items-end justify-between">
            <div>
              <h3 className="font-display text-2xl leading-none">{character.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{character.age} · {character.location}</p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-primary/90">{character.emotionalStatus}</span>
          </div>
        </motion.div>

        {/* Hover detail panel */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="panel"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-0 inset-x-0 z-20 m-2.5 rounded-xl overflow-hidden"
              style={{ background: "hsl(var(--surface-glass) / 0.85)", backdropFilter: "blur(16px)" }}
            >
              <div className="p-4 space-y-3">
                {/* Name + status row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl leading-tight">{character.name}</h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {character.age} · {character.location}
                    </div>
                  </div>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {character.emotionalStatus}
                  </motion.span>
                </div>

                {/* Intro quote — what they'll say first */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="border-l-2 border-primary/30 pl-3"
                >
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Their opening</p>
                  <p className="text-xs text-foreground/90 italic leading-relaxed line-clamp-2">
                    "{character.intro}"
                  </p>
                </motion.div>

                {/* Summary */}
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.13 }}
                  className="text-xs text-muted-foreground leading-relaxed line-clamp-2"
                >
                  {character.summary}
                </motion.p>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="flex items-center justify-between pt-1"
                >
                  <div className="flex gap-1">
                    {character.tags.map((tg) => (
                      <span key={tg} className="rounded-full bg-surface/60 border border-border/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {t(`tags.${tg}`)}
                      </span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Talk <ArrowUpRight className="h-3 w-3" />
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>
    </motion.div>
  );
};
