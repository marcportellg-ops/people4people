import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { CharacterCard } from "@/components/CharacterCard";
import { TrustStrip } from "@/components/Trust";
import { characters } from "@/data/characters";
import type { Character } from "@/data/characters";
import {
  getAllUserCharacters, getWeeklyRanking, type RankingEntry,
  getCharacterTagStats, getDiscoveryData, type DiscoveryData,
  getHelperRecentEmotionTags, saveCharacterTranslations,
} from "@/lib/db";
import { translateCharacterFields } from "@/lib/claude";
import { Search, TrendingUp, Heart, Flame, Sparkles, Shuffle, X, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

const allTags = Array.from(new Set(characters.flatMap((c) => c.tags)));
const MEDALS = ["🏆", "🥈", "🥉"];
const INTENSE_TAGS = new Set(["Devastadora", "Agotadora", "Removedora"]);
const CALM_TAGS_SET = new Set(["Tranquila", "Sanadora", "Esperanzadora", "Fluida"]);
const INTENSE_BALANCE_TAGS = new Set(["Devastadora", "Agotadora", "Removedora", "Pesada", "Oscura"]);
const CALM_BALANCE_TAGS = new Set(["Tranquila", "Sanadora", "Esperanzadora", "Fluida", "Luminosa"]);

type DiscoveryMode = "trending" | "lonely" | "intense" | "new" | null;

const DISCOVERY_MODES: { key: DiscoveryMode; icon: React.ReactNode }[] = [
  { key: "trending", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "lonely", icon: <Heart className="h-3.5 w-3.5" /> },
  { key: "intense", icon: <Flame className="h-3.5 w-3.5" /> },
  { key: "new", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

function applyDiscovery(
  list: Character[],
  mode: DiscoveryMode,
  data: DiscoveryData | null,
  tagStats: Record<string, string[]>,
): Character[] {
  if (!mode || !data) return list;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  switch (mode) {
    case "trending":
      return [...list].sort(
        (a, b) => (data.recentConvCount[b.id] ?? 0) - (data.recentConvCount[a.id] ?? 0),
      );
    case "lonely":
      return [...list].sort((a, b) => {
        const ca = data.recentConvCount[a.id] ?? 0;
        const cb = data.recentConvCount[b.id] ?? 0;
        if (ca !== cb) return ca - cb;
        return (data.lastConvDate[a.id] ?? 0) - (data.lastConvDate[b.id] ?? 0);
      });
    case "intense": {
      const scored = list
        .map((c) => {
          const tags = tagStats[c.id] ?? c.topEmotionTags ?? [];
          return { c, score: tags.filter((t) => INTENSE_TAGS.has(t)).length };
        })
        .filter(({ score }) => score > 0);
      return scored.sort((a, b) => b.score - a.score).map(({ c }) => c);
    }
    case "new":
      return list.filter((c) => {
        const ts = c.createdAt?.toMillis?.() ?? 0;
        return ts >= weekAgo;
      });
    default:
      return list;
  }
}

function pickSurpriseCharacter(recentTags: string[], pool: Character[]): Character | null {
  if (pool.length === 0) return null;
  if (recentTags.length === 0) return pool[Math.floor(Math.random() * pool.length)];

  const intenseCount = recentTags.filter((t) => INTENSE_BALANCE_TAGS.has(t)).length;
  const calmCount = recentTags.filter((t) => CALM_BALANCE_TAGS.has(t)).length;

  let candidates: Character[];
  if (intenseCount > calmCount) {
    candidates = pool.filter(
      (c) =>
        (c.topEmotionTags ?? []).some((t) => CALM_BALANCE_TAGS.has(t)) ||
        ["Hopeful", "Searching"].includes(c.emotionalStatus),
    );
  } else {
    candidates = pool.filter(
      (c) =>
        (c.topEmotionTags ?? []).some((t) => INTENSE_BALANCE_TAGS.has(t)) ||
        ["Heavy", "Anxious", "Tender"].includes(c.emotionalStatus),
    );
  }
  if (candidates.length === 0) candidates = pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const Gallery = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>(null);
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [discoveryData, setDiscoveryData] = useState<DiscoveryData | null>(null);
  const [allTagStats, setAllTagStats] = useState<Record<string, string[]>>({});
  const [recentHelperTags, setRecentHelperTags] = useState<string[]>([]);
  const [surpriseChar, setSurpriseChar] = useState<Character | null>(null);

  useEffect(() => {
    getAllUserCharacters().then(setUserCharacters).catch(() => {});
    getWeeklyRanking().then(setRanking).catch(() => {});
    getDiscoveryData().then(setDiscoveryData).catch(() => {});
  }, []);

  useEffect(() => {
    const allIds = [...characters.map((c) => c.id), ...userCharacters.map((c) => c.id)];
    if (allIds.length === 0) return;
    getCharacterTagStats(allIds).then(setAllTagStats).catch(() => {});
  }, [userCharacters]);

  useEffect(() => {
    if (!user) return;
    getHelperRecentEmotionTags(user.uid).then(setRecentHelperTags).catch(() => {});
  }, [user]);

  // For user-created characters missing the current language, trigger translation
  // and update local state + Firestore so the card shows translated text.
  useEffect(() => {
    if (lang === "en" || userCharacters.length === 0) return;
    const tl = lang as "es" | "it" | "fr";
    const hardcodedIds = new Set(characters.map((c) => c.id));

    userCharacters.forEach((char) => {
      if (hardcodedIds.has(char.id)) return; // already has manual translations
      const existing = char.translations?.[tl];
      if (existing?.intro && existing.summary) return; // already translated
      const fields = {
        narratorStory: char.narratorStory ?? "",
        summary: char.summary,
        longStory: char.longStory,
        intro: char.intro,
      };
      translateCharacterFields(fields, tl).then((translated) => {
        const newTranslations = { ...char.translations, [tl]: translated };
        setUserCharacters((prev) =>
          prev.map((c) => c.id === char.id ? { ...c, translations: newTranslations } : c)
        );
        saveCharacterTranslations(char.id, newTranslations).catch(() => {});
      }).catch(() => {});
    });
  }, [userCharacters, lang]);

  const enrichedUserChars = useMemo(
    () => userCharacters.map((c) => ({ ...c, topEmotionTags: allTagStats[c.id] ?? c.topEmotionTags })),
    [userCharacters, allTagStats],
  );

  const enrichedTestChars = useMemo(
    () => characters.map((c) => ({ ...c, topEmotionTags: allTagStats[c.id] })),
    [allTagStats],
  );

  const baseFilter = (list: Character[]) =>
    list.filter((c) => {
      const matchesQ =
        q === "" || (c.name + c.summary + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase());
      const matchesTag = !tag || c.tags.includes(tag);
      return matchesQ && matchesTag;
    });

  const realFiltered = useMemo(
    () => applyDiscovery(baseFilter(enrichedUserChars), discoveryMode, discoveryData, allTagStats),
    [enrichedUserChars, q, tag, discoveryMode, discoveryData, allTagStats],
  );

  const testFiltered = useMemo(
    () => applyDiscovery(baseFilter(enrichedTestChars), discoveryMode, discoveryData, allTagStats),
    [enrichedTestChars, q, tag, discoveryMode, discoveryData, allTagStats],
  );

  const handleSurprise = () => {
    const pool = [
      ...enrichedUserChars,
      ...enrichedTestChars,
    ];
    const picked = pickSurpriseCharacter(recentHelperTags, pool);
    setSurpriseChar(picked);
  };

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
          <p className="text-xs uppercase tracking-[0.2em] text-primary/90">{t("gallery.eyebrow")}</p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[1.05] text-gradient pb-2">
            {t("gallery.headline").split("\n")[0]}<br />{t("gallery.headline").split("\n")[1]}
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl leading-relaxed">
            {t("gallery.body")}
          </p>
        </motion.div>

        {/* Weekly ranking */}
        {ranking.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-14"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">Esta semana</p>
            <h2 className="mt-2 font-display text-2xl">Top Helpers de la Semana</h2>
            <div className="mt-5 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {ranking.map((entry, i) => (
                <div key={entry.userId} className="glass rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-2xl w-8 text-center shrink-0">
                    {MEDALS[i] ?? <span className="font-display text-muted-foreground/60">{i + 1}</span>}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-base leading-tight truncate">{entry.alias}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.count} sesión{entry.count !== 1 ? "es" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Discovery modes + Search row */}
        <div className="mt-10 space-y-4">
          {/* Discovery mode buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            {DISCOVERY_MODES.map(({ key, icon }) => (
              <button
                key={key}
                onClick={() => setDiscoveryMode((prev) => (prev === key ? null : key))}
                title={t(`gallery.discovery.${key}Desc`)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border transition ${
                  discoveryMode === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {icon}
                {t(`gallery.discovery.${key}`)}
              </button>
            ))}

            {/* Sorpréndeme */}
            <button
              onClick={handleSurprise}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-amber text-primary-foreground px-4 py-1.5 text-xs font-medium shadow-glow hover:scale-[1.03] transition"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {t("gallery.discovery.surprise")}
            </button>
          </div>

          {/* Search + tag filters */}
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("gallery.search")}
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
                {t("gallery.all")}
              </button>
              {allTags.map((tg) => (
                <button
                  key={tg}
                  onClick={() => setTag(tg === tag ? null : tg)}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider transition border ${
                    tg === tag ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`tags.${tg}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Surprise suggestion */}
        <AnimatePresence>
          {surpriseChar && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 glass rounded-3xl p-5 border border-primary/20 flex items-center gap-5"
            >
              <div className="shrink-0 relative h-16 w-12 rounded-xl overflow-hidden">
                <img src={surpriseChar.portrait} alt={surpriseChar.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 mb-0.5">{t("gallery.discovery.suggestedFor")}</p>
                <p className="font-display text-lg leading-tight">{surpriseChar.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{surpriseChar.summary}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => navigate(`/talk/${surpriseChar.id}`)}
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-amber text-primary-foreground px-4 py-2 text-xs font-medium shadow-glow hover:scale-[1.03] transition"
                >
                  {t("gallery.discovery.talk")} <ArrowUpRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setSurpriseChar(null)}
                  className="h-7 w-7 grid place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real characters */}
        {realFiltered.length > 0 && (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {realFiltered.map((c, i) => (
              <CharacterCard key={c.id} character={c} index={i} />
            ))}
          </div>
        )}

        {/* Empty state when no real characters and no search active */}
        {realFiltered.length === 0 && q === "" && !tag && !discoveryMode && (
          <div className="mt-16 rounded-2xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
            <p className="font-display text-2xl text-foreground/60">{t("gallery.noReal")}</p>
            <p className="mt-2 text-sm">{t("gallery.noRealSub")}</p>
          </div>
        )}

        {/* Empty discovery state */}
        {realFiltered.length === 0 && testFiltered.length === 0 && discoveryMode && (
          <div className="mt-16 text-center text-muted-foreground">
            <p className="font-display text-2xl">{t("gallery.discovery.noResults")}</p>
            <p className="mt-2 text-sm">{t("gallery.discovery.noResultsSub")}</p>
          </div>
        )}

        {/* Empty search state */}
        {realFiltered.length === 0 && testFiltered.length === 0 && (q !== "" || tag) && !discoveryMode && (
          <div className="mt-20 text-center text-muted-foreground">
            <p className="font-display text-2xl">{t("gallery.noResults")}</p>
            <p className="mt-2 text-sm">{t("gallery.noResultsSub")}</p>
          </div>
        )}

        {/* Divider + test characters */}
        {testFiltered.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                {t("gallery.testLabel")}
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground/50 text-center">
              {t("gallery.testSub")}
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
