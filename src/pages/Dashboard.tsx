import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { MessageCircle, ShieldCheck, Star, TrendingUp, FileText, Clock, CheckCircle2, AlertCircle, XCircle, RefreshCw, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TrustStrip, TrustBadge } from "@/components/Trust";
import { useAuth } from "@/context/AuthContext";
import { getMyCharacters, getConversationsForCharacters, getAllConversations, getAllUserCharacters, saveCharacterInsights, getCharacterInsights, type ConversationDoc, type ModerationResult, type CharacterInsights } from "@/lib/db";
import { synthesizeCharacterInsights } from "@/lib/claude";
import { characters as hardcodedCharacters, type Character } from "@/data/characters";

type Filter = "all" | "deliver" | "review" | "rejected";

const Dashboard = () => {
  const { user, isModerator } = useAuth();
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [conversations, setConversations] = useState<ConversationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (isModerator) {
        const [firestoreChars, allConvs] = await Promise.all([
          getAllUserCharacters(),
          getAllConversations(),
        ]);
        setMyChars([...hardcodedCharacters, ...firestoreChars]);
        setConversations(allConvs.filter((c) => c.endedAt !== null));
      } else {
        const chars = await getMyCharacters(user.uid);
        setMyChars(chars);
        if (chars.length > 0) {
          const convs = await getConversationsForCharacters(chars.map((c) => c.id));
          setConversations(
            convs.filter((c) => c.endedAt !== null && c.moderation?.decision !== "rejected")
          );
        }
      }
      setLoading(false);
    })();
  }, [user, isModerator]);

  // Stats
  const totalMessages = conversations.reduce((n, c) => n + c.messages.length, 0);
  const thisWeek = conversations.filter((c) => {
    if (!c.startedAt) return false;
    return Date.now() - (c.startedAt.toMillis?.() ?? 0) < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const delivered  = conversations.filter((c) => c.moderation?.decision === "deliver").length;
  const inReview   = conversations.filter((c) => c.moderation?.decision === "review").length;
  const rejected   = conversations.filter((c) => c.moderation?.decision === "rejected").length;
  const pending    = conversations.filter((c) => !c.moderation).length;
  const avgScore   = (() => {
    const scored = conversations.filter((c) => c.moderation?.score != null);
    if (!scored.length) return null;
    return (scored.reduce((s, c) => s + c.moderation!.score, 0) / scored.length).toFixed(1);
  })();

  // Filtered conversations for the list
  const visible = isModerator && filter !== "all"
    ? conversations.filter((c) => {
        if (filter === "rejected") return c.moderation?.decision === "rejected";
        if (filter === "review")   return c.moderation?.decision === "review";
        if (filter === "deliver")  return c.moderation?.decision === "deliver";
        return true;
      })
    : conversations;

  return (
    <div className="min-h-screen pb-24">
      <TopNav />
      <div className="container pt-32 space-y-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/90">
              {isModerator ? "Moderation dashboard" : "Your dashboard"}
            </p>
            <h1 className="mt-3 font-display text-5xl text-gradient pb-2">
              {isModerator ? "All conversations." : "A quiet inbox of care."}
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              {isModerator
                ? "Every conversation across all characters, with moderation scores and decisions."
                : "People you created, the helpers who showed up, and what they offered — all reviewed and anonymized."}
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm hover:border-primary/40 transition"
          >
            + Create another
          </Link>
        </motion.div>

        {/* Stats */}
        <div className={`grid gap-3 ${isModerator ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-4"}`}>
          <Stat icon={MessageCircle} label="Total sessions"   value={String(conversations.length)} />
          <Stat icon={ShieldCheck}   label="Characters live"  value={String(myChars.length)} />
          <Stat icon={Star}          label="Total messages"   value={String(totalMessages)} />
          <Stat icon={TrendingUp}    label="This week"        value={`+${thisWeek}`} />
          {isModerator && <>
            <Stat icon={CheckCircle2} label="Delivered"   value={String(delivered)}  accent="emerald" />
            <Stat icon={AlertCircle}  label="In review"   value={String(inReview)}   accent="amber" />
          </>}
        </div>

        {/* Moderator summary bar */}
        {isModerator && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass rounded-2xl p-5 flex flex-wrap items-center gap-6"
          >
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="font-medium text-emerald-400">{delivered}</span>
              <span className="text-muted-foreground">delivered</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="font-medium text-amber-400">{inReview}</span>
              <span className="text-muted-foreground">in review</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="font-medium text-red-400">{rejected}</span>
              <span className="text-muted-foreground">rejected</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{pending}</span>
              <span className="text-muted-foreground">pending moderation</span>
            </div>
            {avgScore && (
              <div className="ml-auto text-sm text-muted-foreground">
                Avg score: <span className="font-medium text-foreground">{avgScore}/10</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Characters */}
        <section>
          <h2 className="font-display text-2xl mb-5">Your characters</h2>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="glass rounded-2xl p-4 h-28 animate-pulse" />
              ))}
            </div>
          ) : myChars.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-muted-foreground text-sm">You haven't created any characters yet.</p>
              <Link to="/create" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-5 py-2.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition">
                Create your first character
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myChars.map((c, i) => {
                const charConvs = conversations.filter((cv) => cv.characterId === c.id);
                const charDelivered = charConvs.filter((cv) => cv.moderation?.decision === "deliver").length;
                const charAvg = (() => {
                  const scored = charConvs.filter((cv) => cv.moderation?.score != null);
                  if (!scored.length) return null;
                  return (scored.reduce((s, cv) => s + cv.moderation!.score, 0) / scored.length).toFixed(1);
                })();
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06, duration: 0.6 }}
                    className="glass rounded-2xl p-4"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0">
                        <img src={c.portrait} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-xl">{c.name}</h3>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">Live</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.summary}</p>
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{charConvs.length} session{charConvs.length !== 1 ? "s" : ""}</span>
                          {isModerator && charDelivered > 0 && (
                            <span className="text-emerald-400">{charDelivered} delivered</span>
                          )}
                          {isModerator && charAvg && (
                            <span className="ml-auto text-foreground/70">avg {charAvg}/10</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Cross-conversation digest */}
        {!loading && myChars.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="font-display text-2xl">Collective digest</h2>
                <p className="mt-1 text-sm text-muted-foreground">What helpers collectively offered, synthesized across all sessions.</p>
              </div>
            </div>
            <div className="space-y-4">
              {myChars.map((c) => {
                const charConvs = conversations.filter((cv) => cv.characterId === c.id && cv.endedAt !== null);
                if (charConvs.length === 0) return null;
                return (
                  <CharacterDigestCard
                    key={c.id}
                    character={c}
                    conversations={charConvs}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Conversations */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-display text-2xl">
              {isModerator ? "All conversations" : "Conversations delivered to you"}
            </h2>
            <TrustBadge>Anonymized · Moderated</TrustBadge>
          </div>

          {/* Moderator filter tabs */}
          {isModerator && !loading && (
            <div className="flex gap-2 mb-5 flex-wrap">
              {(["all", "deliver", "review", "rejected"] as Filter[]).map((f) => {
                const counts: Record<Filter, number> = {
                  all: conversations.length,
                  deliver: delivered,
                  review: inReview,
                  rejected: rejected,
                };
                const labels: Record<Filter, string> = {
                  all: "All",
                  deliver: "Delivered",
                  review: "In review",
                  rejected: "Rejected",
                };
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition ${
                      filter === f
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {labels[f]}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === f ? "bg-primary/20" : "bg-surface-elevated"}`}>
                      {counts[f]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="glass rounded-3xl p-6 h-40 animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center">
              <p className="font-display text-2xl text-muted-foreground">
                {filter === "all" ? "No conversations yet." : `No ${filter} conversations.`}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {filter === "all"
                  ? "When someone talks to one of your characters, it will appear here."
                  : "Try a different filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((conv, i) => {
                const char = myChars.find((c) => c.id === conv.characterId);
                const helperMessages = conv.messages.filter((m) => m.role === "user");
                const isOpen = expanded === conv.id;
                const when = conv.startedAt
                  ? new Date(conv.startedAt.toMillis?.() ?? 0).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })
                  : "Unknown date";

                return (
                  <motion.article
                    key={conv.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.6 }}
                    className={`glass rounded-3xl p-6 md:p-7 border-l-2 ${
                      conv.moderation?.decision === "deliver" ? "border-l-emerald-500/40" :
                      conv.moderation?.decision === "review"  ? "border-l-amber-500/40" :
                      conv.moderation?.decision === "rejected"? "border-l-red-500/30" :
                      "border-l-border/40"
                    }`}
                  >
                    {/* Header row */}
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {char?.portrait && (
                          <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0">
                            <img src={char.portrait} alt={char.name} className="absolute inset-0 h-full w-full object-cover" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">
                            {char?.name ?? "Unknown"} · {when}
                          </p>
                          <h3 className="mt-0.5 font-display text-lg leading-tight">
                            {helperMessages.length} message{helperMessages.length !== 1 ? "s" : ""} from a helper
                          </h3>
                        </div>
                      </div>
                      <ModerationBadge result={conv.moderation} showScore={isModerator} />
                    </header>

                    {/* Moderation reason (moderator only) */}
                    {isModerator && conv.moderation?.reason && (
                      <div className="mt-3 text-xs text-muted-foreground italic border-l border-border/40 pl-3">
                        {conv.moderation.reason}
                      </div>
                    )}

                    {/* AI summary */}
                    {conv.summary ? (
                      <div className="mt-5 grid md:grid-cols-2 gap-5">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">What the helper offered</p>
                          <p className="text-sm text-foreground/90 leading-relaxed">{conv.summary.summary}</p>
                          {conv.summary.recommendations.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {conv.summary.recommendations.map((r) => (
                                <li key={r} className="flex gap-2 text-sm">
                                  <span className="text-primary mt-0.5 shrink-0">·</span>
                                  <span className="text-foreground/90">{r}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {conv.summary.highlight && (
                          <div>
                            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Emotional highlight</p>
                            <p className="text-sm text-foreground/90 italic leading-relaxed">"{conv.summary.highlight}"</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      helperMessages.length > 0 && (
                        <div className="mt-4 glass rounded-xl p-4">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Last message from helper</p>
                          <p className="text-sm text-foreground/90 italic leading-relaxed">
                            "{helperMessages[helperMessages.length - 1].text}"
                          </p>
                        </div>
                      )
                    )}

                    {/* Transcript toggle */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setExpanded(isOpen ? null : conv.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-secondary border border-border/60 px-4 py-2 text-sm hover:border-primary/40 transition"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {isOpen ? "Hide transcript" : "View full transcript"}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.35 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-5 space-y-2 max-h-80 overflow-y-auto border border-border/40 rounded-2xl p-4">
                            {conv.messages.map((m, mi) => (
                              <div key={mi} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                  m.role === "user"
                                    ? "bg-primary/15 border border-primary/20"
                                    : "bg-surface-elevated/80 border border-border/60"
                                }`}>
                                  <span className="block text-[10px] text-muted-foreground mb-1">
                                    {m.role === "user" ? "Helper" : char?.name ?? "Character"}
                                  </span>
                                  {m.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>

        <TrustStrip />
      </div>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const Stat = ({
  icon: Icon, label, value, accent,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) => (
  <div className="glass rounded-2xl p-5">
    <Icon className={`h-4 w-4 ${accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-primary"}`} />
    <p className={`mt-3 font-display text-3xl ${accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : ""}`}>
      {value}
    </p>
    <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
  </div>
);

const CharacterDigestCard = ({
  character,
  conversations,
}: {
  character: Character;
  conversations: ConversationDoc[];
}) => {
  const [insights, setInsights] = useState<CharacterInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getCharacterInsights(character.id)
      .then(setInsights)
      .finally(() => setLoading(false));
  }, [character.id]);

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await synthesizeCharacterInsights(character, conversations);
      await saveCharacterInsights(character.id, { ...result, conversationCount: conversations.length });
      const saved = await getCharacterInsights(character.id);
      setInsights(saved);
    } finally {
      setGenerating(false);
    }
  };

  const isStale = insights && insights.conversationCount !== conversations.length;
  const generatedDate = insights?.generatedAt
    ? new Date((insights.generatedAt as any).toMillis?.() ?? 0).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="glass rounded-3xl p-6 md:p-7"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0">
            <img src={character.portrait} alt={character.name} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div>
            <h3 className="font-display text-lg">{character.name}</h3>
            <p className="text-xs text-muted-foreground">
              {conversations.length} session{conversations.length !== 1 ? "s" : ""}
              {generatedDate && !isStale && <span> · digest from {generatedDate}</span>}
              {isStale && <span className="text-amber-400"> · {conversations.length - insights!.conversationCount} new session{conversations.length - insights!.conversationCount !== 1 ? "s" : ""} since last digest</span>}
            </p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary px-4 py-2 text-xs hover:border-primary/40 transition disabled:opacity-50"
        >
          {generating ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : insights ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {generating ? "Generating…" : insights ? "Regenerate" : "Generate digest"}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-5 space-y-3 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-surface-elevated" />
          <div className="h-4 w-1/2 rounded bg-surface-elevated" />
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Sparkles className="h-4 w-4 text-primary" />
          </motion.div>
          Synthesizing {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}…
        </div>
      )}

      {/* Insights */}
      {!loading && !generating && insights && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-5 space-y-5"
          >
            {/* Overview */}
            <p className="text-sm text-foreground/90 leading-relaxed">{insights.overview}</p>

            {/* Themes */}
            {insights.themes.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Recurring themes</p>
                <div className="flex flex-wrap gap-2">
                  {insights.themes.map((t) => (
                    <span
                      key={t.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary"
                    >
                      {t.label}
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium">×{t.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top moments */}
            {insights.topMoments.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Best moments from helpers</p>
                <div className="space-y-2.5">
                  {insights.topMoments.map((m, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-primary/50 font-display text-lg leading-none mt-0.5">"</span>
                      <p className="text-sm text-foreground/90 italic leading-relaxed">{m}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state */}
      {!loading && !generating && !insights && (
        <div className="mt-5 text-sm text-muted-foreground">
          Generate a digest to see what {conversations.length} helper{conversations.length !== 1 ? "s" : ""} collectively offered {character.name}.
        </div>
      )}
    </motion.div>
  );
};

const ModerationBadge = ({ result, showScore }: { result?: ModerationResult; showScore: boolean }) => {
  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-surface-elevated/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3 w-3" /> Pending review
      </span>
    );
  }
  const styles = {
    deliver:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    review:   "bg-amber-500/15  text-amber-400  border-amber-500/25",
    rejected: "bg-red-500/15    text-red-400    border-red-500/25",
  };
  const icons = {
    deliver:  <CheckCircle2 className="h-3 w-3" />,
    review:   <AlertCircle  className="h-3 w-3" />,
    rejected: <XCircle      className="h-3 w-3" />,
  };
  const labels = { deliver: "Delivered", review: "In review", rejected: "Rejected" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${styles[result.decision]}`}>
      {icons[result.decision]}
      {labels[result.decision]}{showScore ? ` · ${result.score}/10` : ""}
    </span>
  );
};

export default Dashboard;
