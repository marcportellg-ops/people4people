import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronRight, Mic, MicOff, Send, ShieldCheck, Clock, Volume2, VolumeX, Music } from "lucide-react";
import { ambient, type AmbientStatus } from "@/lib/ambient";
import { TopNav } from "@/components/TopNav";
import { TrustBadge } from "@/components/Trust";
import { characters, getCharacter, type Character } from "@/data/characters";
import { getCharacterReply, summarizeConversation, moderateConversation, detectCrisis, generateNarratorStory, translateCharacterFields, generateDynamicOpening } from "@/lib/claude";
import { createConversation, saveMessages, endConversation, getCharacterById, saveConversationSummary, saveConversationModeration, saveNarratorStory, saveCharacterTranslations, getPausedConversation, pauseConversation, getUserTrophies, awardTrophies, setUserLevel, updateStreak, rebuildWeeklyRanking, getHelperConversations } from "@/lib/db";
import { EmotionTagScreen } from "@/components/EmotionTagScreen";
import { sendDeliveryEmail } from "@/lib/email";
import { isSpeechSupported, startRecognition, speakText, stopSpeaking, fetchNarratorAudio } from "@/lib/voice";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePlan } from "@/context/PlanContext";
import { useUserProfile } from "@/context/UserProfileContext";
import { TrophyNotification } from "@/components/TrophyNotification";
import { evaluateTrophies } from "@/lib/trophies";
import { calculateLevel, LEVEL_META } from "@/lib/levels";
import { IMPACT_TROPHY_IDS } from "@/lib/trophies";

type Msg = { role: "char" | "user"; text: string; t: string };

// ── Atmospheric color per emotional state ────────────────────────────────────
const ATMOSPHERE: Record<string, string> = {
  Heavy:     "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(218 80% 7% / 0.55), transparent)",
  Withdrawn: "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(220 8%  8% / 0.50), transparent)",
  Anxious:   "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(142 50% 5% / 0.45), transparent)",
  Searching: "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(196 55% 6% / 0.45), transparent)",
  Tender:    "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(30  60% 6% / 0.45), transparent)",
  Hopeful:   "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(270 45% 8% / 0.42), transparent)",
};

// ── Emotional typography detection ──────────────────────────────────────────
const HEAVY_WORDS = new Set([
  "silence","empty","alone","gone","forget","forgot","loss","lost","never","nothing",
  "silencio","vacío","solo","sola","ausencia","pérdida","perdido","lejos","nunca","nada","olvidé","olvido",
  "vide","seul","seule","perdu","disparu","jamais","rien","loin",
  "silenzio","vuoto","perduto","assenza","mai","niente","lontano",
]);

function isEmotionallyCharged(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("...") || lower.includes("…")) return true;
  const words = lower.split(/\s+/).filter(Boolean);
  const clean = (w: string) => w.replace(/[.,;:!?'"¿¡""'']/g, "");
  if (words.some((w) => HEAVY_WORDS.has(clean(w))) && words.length <= 14) return true;
  return false;
}

const Conversation = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { canConverse, refetch: refetchPlan } = usePlan();
  const { refetch: refetchProfile } = useUserProfile();
  const navigate = useNavigate();

  const [character, setCharacter] = useState<Character | undefined>(
    id ? getCharacter(id) : undefined,
  );
  const [phase, setPhase] = useState<"narrator" | "chat">("narrator");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [ended, setEnded] = useState(false);
  const [fullSession, setFullSession] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [crisisLevel, setCrisisLevel] = useState<"low" | "high" | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [isResumed, setIsResumed] = useState(false);
  const [showTagScreen, setShowTagScreen] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [pendingTrophies, setPendingTrophies] = useState<string[]>([]);
  const [activeTrophy, setActiveTrophy] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const endedRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const timeLeftRef = useRef(15 * 60);
  const resumeCheckedRef = useRef(false);

  // Keep refs in sync so the unmount cleanup always has current values
  useEffect(() => { endedRef.current = ended; }, [ended]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Start ambient music when character is known; stop on unmount
  useEffect(() => {
    if (!character) return;
    ambient.start(character.emotionalStatus as AmbientStatus);
    return () => { ambient.stop(); };
  }, [character?.emotionalStatus]);

  // Handle music mute toggle
  useEffect(() => { ambient.setMuted(musicMuted); }, [musicMuted]);

  // Load from Firestore if not a hardcoded character
  useEffect(() => {
    if (character || !id) return;
    getCharacterById(id).then((c) => { if (c) setCharacter(c); });
  }, [id]);

  // Check for a paused conversation — if found, restore it and skip narrator
  useEffect(() => {
    if (!user || !character || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    getPausedConversation(user.uid, character.id).then((paused) => {
      if (!paused || paused.messages.length === 0) return;
      setConversationId(paused.id);
      setMessages(paused.messages as Msg[]);
      setTimeLeft(paused.timeLeft ?? 15 * 60);
      setIsResumed(true);
      setPhase("chat");
    }).catch(() => {});
  }, [user, character]);

  // Lazy-generate translations for non-English languages if not yet saved
  useEffect(() => {
    if (!character || lang === "en") return;
    const tl = lang as "es" | "it" | "fr";
    const existing = character.translations?.[tl];
    if (existing?.narratorStory && existing.summary && existing.longStory && existing.intro) return;
    // Only translate Firestore characters (not hardcoded test ones)
    const isFirestoreChar = !characters.find((c) => c.id === character.id);
    if (!isFirestoreChar) return;
    const fields = {
      narratorStory: character.narratorStory ?? "",
      summary: character.summary,
      longStory: character.longStory,
      intro: character.intro,
    };
    translateCharacterFields(fields, tl).then((translated) => {
      const newTranslations = { ...character.translations, [tl]: translated };
      setCharacter((c) => c ? { ...c, translations: newTranslations } : c);
      saveCharacterTranslations(character.id, newTranslations).catch(() => {});
    }).catch(() => {});
  }, [character?.id, lang]);

  // If a Firestore character is missing narratorStory, generate and save it
  useEffect(() => {
    if (!character) return;
    if (character.narratorStory) return;
    // Hardcoded characters without a story skip the narrator phase
    const isFirestoreChar = !characters.find((c) => c.id === character.id);
    if (!isFirestoreChar) { setPhase("chat"); return; }

    generateNarratorStory(
      { name: character.name, age: character.age, location: character.location, longStory: character.longStory },
      [],
    ).then((story) => {
      setCharacter((c) => c ? { ...c, narratorStory: story } : c);
      saveNarratorStory(character.id, story).catch(() => {});
    }).catch(() => setPhase("chat"));
  }, [character?.id]);

  // Show intro message only when entering chat phase (skip when resuming)
  useEffect(() => {
    if (phase !== "chat" || !character || isResumed) return;
    let cancelled = false;

    const showOpening = async () => {
      const staticFallback = (lang !== "en" && character.translations?.[lang as "es"|"it"|"fr"]?.intro) || character.intro;
      let introText = staticFallback;

      try {
        const generated = await generateDynamicOpening(character, lang);
        if (generated) introText = generated;
      } catch {
        // keep staticFallback
      }

      if (cancelled) return;
      setMessages([{ role: "char", text: introText, t: now() }]);
      setSpeaking(true);
      setSpeakingMsgIdx(0);
      speakText(introText, {
        characterName: character.name,
        gender: character.gender,
        emotionalStatus: character.emotionalStatus,
        onEnd: () => { setSpeaking(false); setSpeakingMsgIdx(null); },
      });
    };

    const t0 = setTimeout(() => { showOpening(); }, 600);
    return () => { cancelled = true; clearTimeout(t0); };
  }, [phase, character?.id]);

  // Create conversation in Firestore only when entering chat phase (skip when resuming)
  useEffect(() => {
    if (phase !== "chat" || !character || !user || isResumed) return;
    if (!canConverse) { navigate("/subscribe"); return; }
    createConversation(character.id, user.uid).then((id) => {
      setConversationId(id);
      refetchPlan();
    }).catch(() => {});
  }, [phase, character, user, isResumed]);

  // Countdown timer — only runs in chat phase
  useEffect(() => {
    if (phase !== "chat" || ended) return;
    if (timeLeft <= 0) { setFullSession(true); setEnded(true); setShowTagScreen(true); return; }
    const i = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(i);
  }, [phase, ended, timeLeft]);

  // Drain trophy notification queue one at a time
  useEffect(() => {
    if (activeTrophy || pendingTrophies.length === 0) return;
    const [next, ...rest] = pendingTrophies;
    setActiveTrophy(next);
    setPendingTrophies(rest);
  }, [activeTrophy, pendingTrophies]);

  // Keep messages ref in sync for summarization
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Stop audio + pause conversation when leaving the page
  useEffect(() => () => {
    stopSpeaking();
    if (!endedRef.current && conversationIdRef.current && messagesRef.current.length > 1) {
      pauseConversation(conversationIdRef.current, timeLeftRef.current).catch(() => {});
    }
  }, []);

  // When session ends: save + summarize + moderate + trophies + level + ranking
  useEffect(() => {
    if (!ended || !conversationId || !character || !user) return;
    endConversation(conversationId).catch(() => {});
    updateStreak(user.uid).catch(() => {});
    const msgs = messagesRef.current.slice(1); // skip character intro
    if (msgs.filter((m) => m.role === "user").length >= 2) {
      const creatorEmail = (character as any).creatorEmail as string | undefined;
      Promise.all([
        summarizeConversation(character, msgs),
        moderateConversation(character, msgs),
      ]).then(async ([s, m]) => {
        await saveConversationSummary(conversationId, s);
        await saveConversationModeration(conversationId, m);

        if (m.decision === "deliver" && creatorEmail) {
          sendDeliveryEmail({
            toEmail: creatorEmail,
            characterName: character.name,
            summary: s.summary,
            highlight: s.highlight,
            recommendations: s.recommendations,
          }).catch(() => {});
        }

        // Trophies + level + ranking
        try {
          const [existingTrophies, allConvs] = await Promise.all([
            getUserTrophies(user.uid),
            getHelperConversations(user.uid),
          ]);
          const existingIds = new Set(existingTrophies.map((t) => t.id));
          // Build the completed conv list including this one with moderation
          const completedConv = { ...messagesRef.current, helperId: user.uid, characterId: character.id, endedAt: { toMillis: () => Date.now() } as any, startedAt: null, messages: messagesRef.current, id: conversationId, moderation: m, seenByCreator: false };

          const newIds = evaluateTrophies({
            allConvs: [...allConvs, completedConv],
            newConv: completedConv,
            newScore: m.score,
            characterLocation: character.location,
            fullSession,
            existingTrophyIds: existingIds,
          });

          if (newIds.length > 0) {
            await awardTrophies(user.uid, newIds);
            setPendingTrophies(newIds);
          }

          // Recalculate level
          const allCompleted = [...allConvs, completedConv];
          const quality = allCompleted.filter((c) => (c.moderation?.score ?? 0) >= 7).length;
          const updatedTrophies = [...existingTrophies, ...newIds.map((id) => ({ id } as any))];
          const hasImpact = updatedTrophies.some((t) => IMPACT_TROPHY_IDS.includes(t.id));
          const newLevel = calculateLevel(quality, hasImpact, false);
          await setUserLevel(user.uid, newLevel);

          // Rebuild weekly ranking
          rebuildWeeklyRanking().catch(() => {});

          refetchProfile();
        } catch { /* non-critical */ }
      }).catch(() => {});
    }
  }, [ended, conversationId, character, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  if (!character) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-muted-foreground">{t("conversation.notFound")}</p>
      </div>
    );
  }

  if (phase === "narrator") {
    // Wait until the narrator story is ready before mounting NarratorPhase
    if (!character.narratorStory) {
      return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
          <div className="pointer-events-none fixed inset-0 -z-10">
            <img src={character.portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110" />
            <div className="absolute inset-0 bg-background/88" />
          </div>
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="text-sm text-muted-foreground tracking-wide"
          >
            {t("conversation.preparing")} {character.name}{t("conversation.storySuffix")}
          </motion.p>
        </div>
      );
    }
    return (
      <NarratorPhase
        character={character}
        narratorText={(lang !== "en" && character.translations?.[lang as "es"|"it"|"fr"]?.narratorStory) || (character.narratorStory ?? "")}
        onEnter={() => setPhase("chat")}
      />
    );
  }

  const toggleListening = () => {
    if (listening) {
      recognizerRef.current?.stop();
      recognizerRef.current = null;
      setListening(false);
      return;
    }
    if (!isSpeechSupported()) return;
    stopSpeaking();
    setSpeaking(false);
    const rec = startRecognition(
      (interim) => setInput(interim),
      (final) => {
        setListening(false);
        setInput(final);
        recognizerRef.current = null;
      },
      () => { setListening(false); recognizerRef.current = null; },
      { lang },
    );
    recognizerRef.current = rec;
    if (rec) setListening(true);
  };

  const send = async (textOverride?: string) => {
    const msgText = (textOverride ?? input).trim();
    if (!msgText || ended || timeLeft === 0 || isTyping) return;
    const userMsg: Msg = { role: "user", text: msgText, t: now() };
    setMessages((m) => [...m, userMsg]);
    if (!textOverride) setInput("");
    setIsTyping(true);

    // Build the conversation history in the format Claude expects.
    // Skip the first character message (the intro) since the system prompt already covers it.
    // Claude requires messages to alternate user/assistant, starting with user.
    const history = [...messages, userMsg]
      .slice(1) // skip the character's opening intro
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

    try {
      const reply = await getCharacterReply(character, history, lang);
      const charT = now();
      const updatedMsgs = [...messages, userMsg, { role: "char" as const, text: reply, t: charT }];
      setMessages(updatedMsgs);
      const replyIdx = updatedMsgs.length - 1;
      if (conversationId) {
        await saveMessages(conversationId, [
          { role: "user", text: userMsg.text, t: userMsg.t },
          { role: "char", text: reply, t: charT },
        ]);
      }
      // Always speak character reply
      setSpeaking(true);
      setSpeakingMsgIdx(replyIdx);
      speakText(reply, {
        characterName: character.name,
        gender: character.gender,
        emotionalStatus: character.emotionalStatus,
        onEnd: () => { setSpeaking(false); setSpeakingMsgIdx(null); },
      });
      // Run crisis detection if not already flagged at high level
      if (crisisLevel !== "high") {
        detectCrisis(updatedMsgs.slice(-8).map((m) => ({ role: m.role, text: m.text })))
          .then(({ crisis, level }) => {
            if (crisis) setCrisisLevel((prev) => (prev === "high" ? "high" : level));
          })
          .catch(() => {});
      }
    } catch {
      setMessages((m) => [...m, { role: "char", text: "Sorry, I couldn't respond right now. Please try again.", t: now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const endSession = () => { setEnded(true); setShowTagScreen(true); };

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: "easeIn" }}
    >
      <TopNav />

      {/* Ambient portrait backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img
          src={character.portrait}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-2xl scale-110"
        />
        <div className="absolute inset-0 bg-background/85" />
        {/* Atmospheric color tint per emotionalStatus */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 4 }}
          style={{ background: ATMOSPHERE[character.emotionalStatus] ?? "" }}
        />
      </div>

      <div className="container pt-24 pb-12 grid lg:grid-cols-[420px_1fr] gap-8">
        {/* Portrait & info */}
        <aside className="lg:sticky lg:top-24 self-start space-y-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" /> {t("conversation.backToGallery")}
          </button>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-portrait"
          >
            <motion.img
              animate={{ scale: ended ? 1 : [1, 1.03, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              src={character.portrait}
              alt={character.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-portrait" />
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/50 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-primary animate-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                {character.emotionalStatus}
              </span>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-5">
              <h2 className="font-display text-3xl">{character.name}</h2>
              <p className="text-sm text-muted-foreground">{character.age} · {character.location}</p>
            </div>
          </motion.div>

          <div className="glass rounded-2xl p-4 space-y-3 text-sm">
            <p className="text-muted-foreground leading-relaxed">{(lang !== "en" && character.translations?.[lang as "es"|"it"|"fr"]?.longStory) || character.longStory}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {character.tags.map((tg) => (
                <span key={tg} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t(`tags.${tg}`)}
                </span>
              ))}
            </div>
          </div>

          <TrustBadge>{t("conversation.trust")}</TrustBadge>
        </aside>

        {/* Chat */}
        <section className="flex flex-col h-[calc(100vh-8rem)] glass-strong rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm">{t("conversation.safeSession")} {character.name}</span>
              {speaking && (
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="inline-flex items-center gap-1 text-[10px] text-primary uppercase tracking-wider"
                >
                  <Volume2 className="h-3 w-3" /> {t("conversation.speaking")}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 text-xs tabular-nums transition ${
                timeLeft <= 120 && !ended ? "text-destructive font-medium" : "text-muted-foreground"
              }`}>
                <Clock className="h-3 w-3" /> {fmt(timeLeft)}
              </span>
              {isSpeechSupported() && !ended && (
                <button
                  onClick={() => {
                    const next = !voiceEnabled;
                    setVoiceEnabled(next);
                    if (!next) stopSpeaking();
                  }}
                  title={voiceEnabled ? "Turn off voice" : "Turn on voice"}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    voiceEnabled
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  {voiceEnabled ? t("conversation.voiceOn") : t("conversation.voiceOff")}
                </button>
              )}
              {!ended && (
                <button
                  onClick={endSession}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs hover:border-destructive/60 hover:text-destructive transition"
                >
                  {t("conversation.endSession")}
                </button>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-8 py-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const charged = m.role === "char" && isEmotionallyCharged(m.text);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 flex items-center gap-1.5">
                        {m.role === "user" ? "You" : character.name} · {m.t}
                        {speakingMsgIdx === i && (
                          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}>
                            <Volume2 className="h-2.5 w-2.5 text-primary" />
                          </motion.span>
                        )}
                      </span>
                      <div
                        className={`rounded-2xl px-4 py-3 leading-relaxed transition-all ${
                          m.role === "user"
                            ? "bg-primary/15 text-foreground border border-primary/20 rounded-br-sm"
                            : `bg-surface-elevated/80 border border-border/60 rounded-bl-sm ${
                                charged ? "tracking-[0.025em] text-foreground border-border/80" : "text-foreground/90"
                              }`
                        } ${speakingMsgIdx === i ? "ring-1 ring-primary/30" : ""}`}
                      >
                        {m.text}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-surface-elevated/80 border border-border/60 px-4 py-3 inline-flex gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.15 }}
                      className="h-1.5 w-1.5 rounded-full bg-foreground/70"
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {crisisLevel && <CrisisAlert level={crisisLevel} />}
            {ended && <EndState character={character.name} />}
          </div>

          {/* Input */}
          {!ended && timeLeft > 0 && (
            <div className="border-t border-border/40 p-4 bg-surface/40">
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={toggleListening}
                  disabled={!isSpeechSupported() || isTyping}
                  animate={listening ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className={`grid h-11 w-11 place-items-center rounded-full border transition ${
                    listening
                      ? "bg-red-500/20 border-red-500/60 text-red-400"
                      : "bg-secondary border-border/60 hover:border-primary/40"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  aria-label={listening ? "Stop listening" : "Speak"}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </motion.button>
                <div className="flex-1 relative">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send(undefined)}
                    disabled={listening}
                    placeholder={listening ? t("conversation.listening") : `${t("conversation.replyTo")} ${character.name}…`}
                    className={`w-full rounded-full bg-surface border px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition ${
                      listening ? "border-red-500/40 text-muted-foreground italic" : "border-border"
                    }`}
                  />
                </div>
                <button
                  onClick={() => send(undefined)}
                  className="grid h-11 w-11 place-items-center rounded-full bg-gradient-amber text-primary-foreground shadow-glow hover:scale-105 transition"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/80 px-2 flex items-center gap-2">
                <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse" /> {t("conversation.reviewedNote")}
              </p>
            </div>
          )}

          {/* Time's up */}
          {(ended || timeLeft === 0) && (
            <div className="border-t border-border/40 p-5 text-center space-y-1">
              <p className="text-sm font-medium">{t("conversation.sessionEnded")}</p>
              <p className="text-xs text-muted-foreground">{t("conversation.sessionEndedSub")}</p>
            </div>
          )}
        </section>
      </div>

      <TrophyNotification
        trophyId={activeTrophy}
        onDismiss={() => setActiveTrophy(null)}
      />

      <AnimatePresence>
        {showTagScreen && (
          <EmotionTagScreen
            conversationId={conversationId}
            characterId={character.id}
            onDone={() => setShowTagScreen(false)}
          />
        )}
      </AnimatePresence>

      {/* Ambient music mute button */}
      <button
        onClick={() => setMusicMuted((m) => !m)}
        title={musicMuted ? "Activar música" : "Silenciar música"}
        className="fixed bottom-6 right-6 z-40 h-9 w-9 grid place-items-center rounded-full bg-background/60 backdrop-blur border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition"
      >
        <Music className={`h-3.5 w-3.5 transition ${musicMuted ? "opacity-25" : "opacity-80"}`} />
      </button>
    </motion.div>
  );
};

const EndState = ({ character }: { character: string }) => {
  const { t } = useLanguage();
  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8 }}
    className="mt-10 mx-auto max-w-md text-center space-y-4 py-10"
  >
    <div className="mx-auto h-12 w-12 rounded-full bg-gradient-amber grid place-items-center shadow-glow">
      <ShieldCheck className="h-5 w-5 text-primary-foreground" />
    </div>
    <h3 className="font-display text-3xl">{t("conversation.thankYou")}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">
      {t("conversation.thankYouBody").replace("{name}", character)}
    </p>
    <Link
      to="/gallery"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm hover:border-primary/40 transition"
    >
      {t("conversation.returnGallery")}
    </Link>
  </motion.div>
  );
};

const CrisisAlert = ({ level }: { level: "low" | "high" }) => {
  const { t } = useLanguage();
  return (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    className={`rounded-2xl border p-4 space-y-2 ${
      level === "high"
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-primary/8 border-primary/20"
    }`}
  >
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-base">{level === "high" ? "🟠" : "🔵"}</span>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          {level === "high" ? t("conversation.crisis.high") : t("conversation.crisis.low")}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {level === "high" ? t("conversation.crisis.highSub") : t("conversation.crisis.lowSub")}
        </p>
        {level === "high" && (
          <div className="pt-1 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80">{t("conversation.crisis.resources")}</p>
            <p>🇪🇸 Spain — Teléfono de la Esperanza: 717 003 717</p>
            <p>🇺🇸 US — Crisis Text Line: text HOME to 741741</p>
            <p>🇬🇧 UK — Samaritans: 116 123</p>
            <p>🌍 International — <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noreferrer" className="underline hover:text-foreground transition">find your local line</a></p>
          </div>
        )}
      </div>
    </div>
  </motion.div>
  );
};

const NarratorPhase = ({ character, narratorText, onEnter }: { character: Character; narratorText: string; onEnter: () => void }) => {
  const { t } = useLanguage();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const [revealedCount, setRevealedCount] = useState(0);
  const [narrationDone, setNarrationDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const paragraphTimestamps = useRef<number[]>([]);
  const paragraphs = narratorText.split(/\n\n+/).filter(Boolean);

  // Fetch ElevenLabs audio on mount
  useEffect(() => {
    let blobUrl: string | null = null;
    fetchNarratorAudio(narratorText).then((url) => {
      blobUrl = url;
      setAudioUrl(url);
      setAudioLoading(false);
    }).catch(() => setAudioLoading(false));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [narratorText]);

  // Play audio once loaded
  useEffect(() => {
    if (audioLoading || !audioUrl || !audioRef.current) return;
    audioRef.current.play().catch(() => {});
  }, [audioLoading, audioUrl]);

  // Once we know the real audio duration, calculate proportional timestamps per paragraph
  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const duration = audioRef.current.duration;
    const wordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    paragraphTimestamps.current = wordCounts.map((wc) => {
      // Reveal each paragraph 0.3s early so text is visible as narrator speaks it
      const ts = Math.max(0, (cumulative / totalWords) * duration - 0.3);
      cumulative += wc;
      return ts;
    });
  };

  // Sync paragraph reveals to actual playback time
  const handleTimeUpdate = () => {
    if (!audioRef.current || !paragraphTimestamps.current.length) return;
    const t = audioRef.current.currentTime;
    setRevealedCount(paragraphTimestamps.current.filter((ts) => t >= ts).length);
  };

  // Fallback: no ElevenLabs — browser TTS with word-count estimation
  useEffect(() => {
    if (audioLoading || audioUrl) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    let elapsed = 0.3;
    paragraphs.forEach((p, i) => {
      timersRef.current.push(setTimeout(() => setRevealedCount(i + 1), elapsed * 1000));
      elapsed += p.split(/\s+/).length / 2.15 + 0.4;
    });
    timersRef.current.push(setTimeout(() => setNarrationDone(true), elapsed * 1000));
    speakText(narratorText, { narrator: true, onEnd: () => setNarrationDone(true) });
    return () => { timersRef.current.forEach(clearTimeout); stopSpeaking(); };
  }, [audioLoading, audioUrl]);

  const handleEnter = () => {
    if (exiting) return;
    timersRef.current.forEach(clearTimeout);
    if (audioRef.current) { audioRef.current.pause(); }
    else { stopSpeaking(); }
    setExiting(true);
    setTimeout(onEnter, 950);
  };

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden flex flex-col"
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.985 : 1 }}
      transition={{ duration: 0.95, ease: [0.65, 0, 0.35, 1] }}
    >
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setNarrationDone(true)}
        />
      )}

      {/* Ambient portrait backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img
          src={character.portrait}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110"
        />
        <div className="absolute inset-0 bg-background/88" />
        <div
          className="absolute inset-0"
          style={{ background: ATMOSPHERE[character.emotionalStatus] ?? "" }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={handleEnter}
        className="fixed top-6 right-6 z-20 inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition"
      >
        {t("conversation.skip")} <ChevronRight className="h-3 w-3" />
      </button>

      {/* Loading state */}
      {audioLoading && (
        <div className="flex-1 flex items-center justify-center">
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="text-sm text-muted-foreground tracking-wide"
          >
            {t("conversation.preparing")} {character.name}{t("conversation.storySuffix")}
          </motion.p>
        </div>
      )}

      {/* Content */}
      {!audioLoading && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
          <div className="max-w-2xl w-full space-y-10">

            {/* Character header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
              className="flex items-center gap-4"
            >
              <img
                src={character.portrait}
                alt={character.name}
                className="h-14 w-14 rounded-full object-cover border border-border/40"
              />
              <div>
                <p className="font-display text-xl">{character.name}</p>
                <p className="text-sm text-muted-foreground">{character.age} · {character.location}</p>
              </div>
            </motion.div>

            {/* Narrator paragraphs revealed one by one */}
            <div className="space-y-6">
              <AnimatePresence>
                {paragraphs.slice(0, revealedCount).map((p, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="text-lg leading-relaxed text-foreground/80 font-light"
                  >
                    {p}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>

            {/* CTA — appears after narration ends */}
            <AnimatePresence>
              {narrationDone && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <button
                    onClick={handleEnter}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-7 py-3.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
                  >
                    {t("conversation.meet")} {character.name} <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default Conversation;
