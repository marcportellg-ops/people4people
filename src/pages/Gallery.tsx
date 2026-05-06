import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { CharacterCard } from "@/components/CharacterCard";
import { TrustStrip } from "@/components/Trust";
import { characters } from "@/data/characters";
import { getAllUserCharacters } from "@/lib/db";
import { Search } from "lucide-react";

const allTags = Array.from(new Set(characters.flatMap((c) => c.tags)));

const Gallery = () => {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [userCharacters, setUserCharacters] = useState([] as typeof characters);

  useEffect(() => {
    getAllUserCharacters().then(setUserCharacters).catch(() => {});
  }, []);

  const filter = (list: typeof characters) =>
    list.filter((c) => {
      const matchesQ = q === "" || (c.name + c.summary + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase());
      const matchesTag = !tag || c.tags.includes(tag);
      return matchesQ && matchesTag;
    });

  const realFiltered = useMemo(() => filter(userCharacters), [userCharacters, q, tag]);
  const testFiltered = useMemo(() => filter(characters), [q, tag]);

  return (
    <div className="min-h-screen pb-32">
      <TopNav />
      <div className="container pt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-primary/90">The Gallery</p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[1.05] text-gradient pb-2">
            Real stories,<br />held by AI characters.
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl leading-relaxed">
            Each face here represents a real person who asked for help. Your conversation will be
            moderated, anonymized, and gently delivered back to them.
          </p>
        </motion.div>

        {/* Filters */}
        <div className="mt-10 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, theme, feeling…"
              className="w-full rounded-full border border-border bg-surface pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50 transition"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTag(null)}
              className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider transition border ${
                !tag ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t === tag ? null : t)}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider transition border ${
                  t === tag ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Real characters */}
        {realFiltered.length > 0 && (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {realFiltered.map((c, i) => (
              <CharacterCard key={c.id} character={c} index={i} />
            ))}
          </div>
        )}

        {/* Empty state when no real characters and no search active */}
        {realFiltered.length === 0 && q === "" && !tag && (
          <div className="mt-16 rounded-2xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
            <p className="font-display text-2xl text-foreground/60">No real characters yet.</p>
            <p className="mt-2 text-sm">Be the first to share your story.</p>
          </div>
        )}

        {/* Empty search state */}
        {realFiltered.length === 0 && testFiltered.length === 0 && (q !== "" || tag) && (
          <div className="mt-20 text-center text-muted-foreground">
            <p className="font-display text-2xl">No one is waiting under that filter.</p>
            <p className="mt-2 text-sm">Try a different theme — there's always someone here.</p>
          </div>
        )}

        {/* Divider + test characters */}
        {testFiltered.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                AI test characters · not real submissions
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground/50 text-center">
              These characters were created to test the platform. Try talking to them — the experience is the same.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {testFiltered.map((c, i) => (
                <CharacterCard key={c.id} character={c} index={i} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-20">
          <TrustStrip />
        </div>
      </div>
    </div>
  );
};

export default Gallery;
