import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Plus, Settings, Pencil, LogOut, ChevronDown, Mail, Lock, Heart, Zap, MessageSquare } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_LABELS, type Language } from "@/lib/translations";
import { TopNav } from "@/components/TopNav";
import { CharacterCard } from "@/components/CharacterCard";
import { useAuth } from "@/context/AuthContext";
import { signOutUser } from "@/lib/auth";
import {
  getMyCharacters, getDeliveredConversations, markDeliveriesSeen,
  awardImpactTrophy, sendHelperMessage, getHelperMessages, markHelperMessageRead,
  type ConversationDoc, type HelperMessage,
} from "@/lib/db";
import { sendDeliveryEmail } from "@/lib/email";
import { useUserProfile } from "@/context/UserProfileContext";
import { LEVEL_META } from "@/lib/levels";
import { TROPHY_DEFS } from "@/lib/trophies";
import type { Character } from "@/data/characters";

const Profile = () => {
  const { user, isModerator } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { alias, level, levelEmoji, trophies, streak, avgScore, qualitySessions, loading: profileLoading } = useUserProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [deliveries, setDeliveries] = useState<ConversationDoc[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"helper" | "creator">("helper");

  // Helper messages (Como Helper tab)
  const [helperMessages, setHelperMessages] = useState<HelperMessage[]>([]);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Impact + thank-you flow (Como Creador tab)
  const [impactPending, setImpactPending] = useState<Record<string, boolean>>({});
  const [thankYouConv, setThankYouConv] = useState<string | null>(null);
  const [thankYouText, setThankYouText] = useState("");
  const [thankYouSending, setThankYouSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyCharacters(user.uid),
      getHelperMessages(user.uid),
    ]).then(([chars, msgs]) => {
      setMyCharacters(chars);
      setHelperMessages(msgs);
      const ids = chars.map((c) => c.id);
      return getDeliveredConversations(ids).then((convs) => {
        setDeliveries(convs);
        const unseen = convs.filter((c) => !c.seenByCreator).map((c) => c.id);
        if (unseen.length > 0) markDeliveriesSeen(unseen).catch(() => {});
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const unreadMessages = helperMessages.filter((m) => !m.read).length;

  const handleMarkImpact = async (
    convId: string,
    trophyId: "algo_cambio" | "punto_de_giro",
  ) => {
    const key = `${convId}_${trophyId}`;
    setImpactPending((p) => ({ ...p, [key]: true }));
    await awardImpactTrophy(convId, trophyId);
    setImpactPending((p) => ({ ...p, [key]: false }));
    if (thankYouConv === null && !sentMessages.has(convId)) {
      setThankYouConv(convId);
      setThankYouText("");
    }
  };

  const handleDismissImpact = (convId: string) => {
    setSentMessages((prev) => new Set([...prev, convId]));
  };

  const handleSendThankyou = async (convId: string, helperId: string, charName: string) => {
    if (!thankYouText.trim() || thankYouSending) return;
    setThankYouSending(true);
    await sendHelperMessage(convId, helperId, charName, thankYouText.trim()).catch(() => {});
    setSentMessages((prev) => new Set([...prev, convId]));
    setThankYouConv(null);
    setThankYouText("");
    setThankYouSending(false);
  };

  const handleOpenMessage = (msg: HelperMessage) => {
    const isOpen = expandedMessageId === msg.conversationId;
    setExpandedMessageId(isOpen ? null : msg.conversationId);
    if (!msg.read && !isOpen) {
      markHelperMessageRead(msg.conversationId).catch(() => {});
      setHelperMessages((prev) =>
        prev.map((m) => m.conversationId === msg.conversationId ? { ...m, read: true } : m)
      );
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <TopNav />
      <div className="container pt-32 max-w-5xl">

        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-6"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-20 w-20 rounded-full border-2 border-border/60 shadow-elevated" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/20 border-2 border-primary/30 grid place-items-center text-2xl font-display text-primary">
              {(alias ?? user.displayName ?? "?").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl leading-tight">{alias ?? user.displayName ?? "Anonymous"}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm">
                {levelEmoji} {level}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground/60 italic">{t("profile.nameHidden")}</p>
          </div>
          <button
            onClick={signOutUser}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
          >
            <LogOut className="h-3.5 w-3.5" /> {t("profile.signOut")}
          </button>
        </motion.div>

        {/* Tabs */}
        <div className="mt-10 flex gap-1 border-b border-border/40">
          {(["helper", "creator"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "helper" ? t("profile.tabHelper") : t("profile.tabCreator")}
              {tab === "helper" && unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] text-primary-foreground font-medium grid place-items-center">
                  {unreadMessages}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* HELPER VIEW */}
        <AnimatePresence mode="wait">
          {activeTab === "helper" && (
            <motion.div
              key="helper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="mt-10 space-y-10"
            >
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={t("profile.statLevel")} value={`${levelEmoji} ${level}`} sub={LEVEL_META[level].description} />
                <StatCard label={t("profile.statStreak")} value={`${streak}d`} sub={t("profile.statStreakSub")} />
                <StatCard label={t("profile.statAvgScore")} value={avgScore > 0 ? avgScore.toFixed(1) : "—"} sub={t("profile.statAvgScoreSub")} />
                <StatCard label={t("profile.statQuality")} value={String(qualitySessions)} sub={t("profile.statQualitySub")} />
              </div>

              {/* Messages from creators */}
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <MessageSquare className="h-5 w-5 text-primary/70" />
                  <h2 className="font-display text-2xl">{t("profile.messagesSection")}</h2>
                  {unreadMessages > 0 && (
                    <span className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-xs text-primary">
                      {unreadMessages}
                    </span>
                  )}
                </div>
                {helperMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
                    <p className="text-muted-foreground text-sm">{t("profile.noMessagesSub")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {helperMessages
                      .sort((a, b) => (a.read ? 1 : 0) - (b.read ? 1 : 0))
                      .map((msg) => {
                        const isOpen = expandedMessageId === msg.conversationId;
                        return (
                          <motion.div
                            key={msg.conversationId}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`glass rounded-2xl border-l-2 overflow-hidden ${!msg.read ? "border-l-primary" : "border-l-border/40"}`}
                          >
                            <button
                              onClick={() => handleOpenMessage(msg)}
                              className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/5 transition"
                            >
                              <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${!msg.read ? "bg-primary/15 text-primary" : "bg-surface-elevated text-muted-foreground"}`}>
                                <MessageSquare className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  {t("profile.messageFrom", { name: msg.characterName })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {!msg.read && (
                                  <span className="h-2 w-2 rounded-full bg-primary" />
                                )}
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </div>
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-5 pt-1 border-t border-border/30">
                                    <p className="text-sm text-foreground/90 leading-relaxed">{msg.message}</p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </section>

              {/* Trophies */}
              <section>
                <h2 className="font-display text-2xl mb-5">{t("profile.trophiesSection")}</h2>
                {profileLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[0,1,2,3].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface-elevated/60 animate-pulse" />)}
                  </div>
                ) : trophies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
                    <p className="text-muted-foreground text-sm">{t("profile.noTrophiesSub")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {trophies.map((trophy) => {
                      const def = TROPHY_DEFS[trophy.id];
                      if (!def) return null;
                      return (
                        <motion.div
                          key={trophy.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`glass rounded-2xl p-4 space-y-2 ${trophy.isSecret ? "border border-primary/20" : ""}`}
                        >
                          <div className="text-3xl">{def.emoji}</div>
                          <div>
                            <p className="text-sm font-medium leading-tight">{def.name}</p>
                            {trophy.isSecret && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-primary/80 uppercase tracking-wider mt-0.5">
                                <Lock className="h-2.5 w-2.5" /> {t("profile.secret")}
                              </span>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{def.description}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {/* CREATOR VIEW */}
          {activeTab === "creator" && (
            <motion.div
              key="creator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="mt-10 space-y-14"
            >
              {/* My characters */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary/90">{t("profile.yourCharacters")}</p>
                    <h2 className="mt-1 font-display text-2xl">{t("profile.storiesShared")}</h2>
                  </div>
                  <Link to="/create" className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-4 py-2 text-sm font-medium shadow-glow hover:scale-[1.02] transition">
                    <Plus className="h-3.5 w-3.5" /> {t("profile.newCharacter")}
                  </Link>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {[0,1,2].map((i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-surface-elevated/60 border border-border/40 animate-pulse" />)}
                  </div>
                ) : myCharacters.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center space-y-4">
                    <p className="font-display text-xl text-foreground/60">{t("profile.noCharacters")}</p>
                    <Link to="/create" className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-primary/40 transition">
                      {t("profile.shareFirst")} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {myCharacters.map((c, i) => (
                      <div key={c.id} className="relative group/card">
                        <CharacterCard character={c} index={i} />
                        <Link to={`/edit/${c.id}`} className="absolute top-3 right-3 z-30 h-8 w-8 grid place-items-center rounded-full bg-background/70 backdrop-blur border border-border/60 text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:text-foreground transition-all" onClick={(e) => e.stopPropagation()}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Responses from helpers */}
              <section>
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary/90">{t("profile.responses")}</p>
                    <h2 className="mt-1 font-display text-2xl">{t("profile.helpersOffered")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("profile.moderatedNote")}</p>
                  </div>
                  {isModerator && (
                    <button
                      onClick={() => sendDeliveryEmail({ toEmail: user.email!, characterName: "Test", summary: "Test email", highlight: "", recommendations: [] }).then(() => alert("sent")).catch(() => {})}
                      className="text-xs text-muted-foreground border border-border/40 rounded-full px-3 py-1.5 hover:border-primary/40 transition shrink-0"
                    >
                      Test email
                    </button>
                  )}
                </div>

                {deliveries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center space-y-2">
                    <p className="font-display text-xl text-foreground/60">{t("profile.noResponses")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveries.map((conv) => {
                      const char = myCharacters.find((c) => c.id === conv.characterId);
                      const isExpanded = expandedId === conv.id;
                      const isNew = conv.seenByCreator === false;
                      const alreadySent = sentMessages.has(conv.id);
                      const isThanking = thankYouConv === conv.id;
                      return (
                        <div key={conv.id} className={`glass rounded-2xl border-l-2 overflow-hidden ${isNew ? "border-l-primary" : "border-l-border/40"}`}>
                          <button onClick={() => setExpandedId(isExpanded ? null : conv.id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition">
                            {char?.portrait && <img src={char.portrait} alt={char.name} className="h-9 w-9 rounded-full object-cover border border-border/60 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{char?.name ?? "Unknown character"}</p>
                              <p className="text-xs text-muted-foreground">{t("profile.helperSession")} — {conv.messages.filter((m) => m.role === "user").length} {t("profile.messages")}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isNew && <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">{t("profile.isNew")}</span>}
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && conv.summary && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                              >
                                <div className="px-4 pb-5 pt-1 space-y-3 border-t border-border/30">
                                  <p className="text-sm text-muted-foreground leading-relaxed">{conv.summary.summary}</p>
                                  {conv.summary.highlight && (
                                    <blockquote className="border-l-2 border-primary/30 pl-3 text-sm italic text-foreground/80">"{conv.summary.highlight}"</blockquote>
                                  )}
                                  {conv.summary.recommendations.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {conv.summary.recommendations.map((r, i) => (
                                        <span key={i} className="rounded-full bg-surface border border-border/60 px-3 py-1 text-xs text-muted-foreground">{r}</span>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => sendDeliveryEmail({ toEmail: user.email!, characterName: char?.name ?? "Unknown", summary: conv.summary!.summary, highlight: conv.summary!.highlight, recommendations: conv.summary!.recommendations }).then(() => alert("Email sent!")).catch(() => {})}
                                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-full px-3 py-1.5 transition mt-1"
                                  >
                                    <Mail className="h-3 w-3" /> {t("profile.sendEmail")}
                                  </button>

                                  {/* Impact buttons */}
                                  {!alreadySent && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
                                      <p className="w-full text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                        {t("profile.markSession")}
                                      </p>
                                      <button
                                        onClick={() => handleMarkImpact(conv.id, "algo_cambio")}
                                        disabled={!!impactPending[`${conv.id}_algo_cambio`]}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                                      >
                                        <Heart className="h-3 w-3" />
                                        {impactPending[`${conv.id}_algo_cambio`] ? "…" : t("profile.impact1")}
                                      </button>
                                      <button
                                        onClick={() => handleMarkImpact(conv.id, "punto_de_giro")}
                                        disabled={!!impactPending[`${conv.id}_punto_de_giro`]}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs text-violet-400 hover:bg-violet-500/20 transition disabled:opacity-50"
                                      >
                                        <Zap className="h-3 w-3" />
                                        {impactPending[`${conv.id}_punto_de_giro`] ? "…" : t("profile.impact2")}
                                      </button>
                                      <button
                                        onClick={() => handleDismissImpact(conv.id)}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-border/40 px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition"
                                      >
                                        {t("profile.impact3")}
                                      </button>
                                    </div>
                                  )}
                                  {alreadySent && (
                                    <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/20">
                                      ✓ Mensaje enviado al helper
                                    </p>
                                  )}

                                  {/* Thank-you message form */}
                                  <AnimatePresence>
                                    {isThanking && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        transition={{ duration: 0.25 }}
                                        className="space-y-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-4"
                                      >
                                        <p className="text-xs text-primary/80 font-medium">
                                          Escribe un mensaje anónimo para el helper
                                        </p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                          Solo verá el nombre de{" "}
                                          <span className="text-foreground/70">{char?.name ?? "tu personaje"}</span>{" "}
                                          y tu mensaje. Nada más.
                                        </p>
                                        <textarea
                                          value={thankYouText}
                                          onChange={(e) => setThankYouText(e.target.value.slice(0, 280))}
                                          placeholder={`La persona detrás de ${char?.name ?? "tu personaje"} quiere que sepas algo.`}
                                          rows={3}
                                          className="w-full rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition resize-none"
                                        />
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[10px] text-muted-foreground">{thankYouText.length}/280</span>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => { setThankYouConv(null); setThankYouText(""); }}
                                              className="rounded-full border border-border/60 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                                            >
                                              Omitir
                                            </button>
                                            <button
                                              onClick={() => handleSendThankyou(conv.id, conv.helperId, char?.name ?? "Unknown")}
                                              disabled={!thankYouText.trim() || thankYouSending}
                                              className="rounded-full bg-primary text-primary-foreground px-5 py-1.5 text-xs font-medium hover:scale-[1.01] transition disabled:opacity-40 disabled:scale-100"
                                            >
                                              {thankYouSending ? "Enviando…" : "Enviar"}
                                            </button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="mt-14">
          <div className="glass rounded-2xl overflow-hidden">
            <button onClick={() => setSettingsOpen((o) => !o)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition">
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("profile.settings")}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {settingsOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="px-6 pb-6 pt-2 border-t border-border/40 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{t("profile.language")}</p>
                      <div className="flex gap-2">
                        {(["en", "es", "it", "fr"] as Language[]).map((l) => (
                          <button key={l} onClick={() => setLang(l)} className={`rounded-full px-4 py-2 text-sm font-medium border transition ${lang === l ? "bg-gradient-amber text-primary-foreground border-transparent shadow-glow" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"}`}>
                            {LANGUAGE_LABELS[l]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="glass rounded-2xl p-5">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-2 font-display text-2xl">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>
  </div>
);

export default Profile;
