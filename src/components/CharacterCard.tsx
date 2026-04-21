import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Character } from "@/data/characters";
import { ArrowUpRight } from "lucide-react";

export const CharacterCard = ({ character, index = 0 }: { character: Character; index?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ delay: (index % 8) * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    className="group relative"
  >
    <Link
      to={`/talk/${character.id}`}
      className="block relative overflow-hidden rounded-2xl bg-surface aspect-[3/4] shadow-elevated"
    >
      <img
        src={character.portrait}
        alt={`${character.name}, ${character.age}`}
        loading="lazy"
        width={768}
        height={960}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-soft group-hover:scale-[1.06]"
      />
      {/* Always-on subtle gradient */}
      <div className="absolute inset-0 bg-gradient-portrait" />

      {/* Top tags */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5">
        {character.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="rounded-full bg-background/40 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80 border border-border/40"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Default name */}
      <div className="absolute bottom-0 inset-x-0 p-5 transition-all duration-500 group-hover:opacity-0 group-hover:translate-y-2">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="font-display text-2xl text-foreground leading-none">{character.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{character.age} · {character.location}</p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.12em] text-primary/90">{character.emotionalStatus}</span>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-end opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="m-3 w-full glass rounded-xl p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
          <p className="font-display text-lg leading-tight">Hi, I'm {character.name}.</p>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">{character.summary}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.12em] text-primary">{character.emotionalStatus}</span>
            <span className="inline-flex items-center gap-1 text-xs text-foreground">
              Talk to me <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  </motion.div>
);
