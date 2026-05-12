import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Mic, MicOff, Send, Clock, Music, Flame } from "lucide-react";
import { ambient, type AmbientStatus } from "@/lib/ambient";
import { characters, getCharacter, type Character } from "@/data/characters";
import {
  getCharacterReply, summarizeConversation, moderateConversation, detectCrisis,
  generateNarratorStory, translateCharacterFields, generateDynamicOpening, generateClosingLine,
} from "@/lib/claude";
import {
  createConversation, saveMessages, endConversation, getCharacterById,
  saveConversationSummary, saveConversationModeration, saveNarratorStory,
  saveCharacterTranslations, getPausedConversation, pauseConversation, discardPausedConversation,
  getUserTrophies, awardTrophies, setUserLevel, updateStreak,
  rebuildWeeklyRanking, getHelperConversations, saveEmotionTags,
} from "@/lib/db";
import { sendDeliveryEmail } from "@/lib/email";
import { isSpeechSupported, startRecognition, speakText, stopSpeaking, fetchNarratorAudio, locationToLang } from "@/lib/voice";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePlan } from "@/context/PlanContext";
import { useUserProfile } from "@/context/UserProfileContext";
import { TrophyNotification } from "@/components/TrophyNotification";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { LoginModal } from "@/components/LoginModal";
import { evaluateTrophies } from "@/lib/trophies";
import { calculateLevel } from "@/lib/levels";
import { IMPACT_TROPHY_IDS } from "@/lib/trophies";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import { getPushPermission } from "@/lib/push";

// ── Types ─────────────────────────────────────────────────────────────────────
type Msg = { role: "char" | "user"; text: string; t: string };
type CinemaPhase = "entrada" | "conversacion" | "cierre";

// ── Atmospheric color per emotional state ─────────────────────────────────────
const ATMOSPHERE: Record<string, string> = {
  Heavy:     "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(218 80% 7% / 0.55), transparent)",
  Withdrawn: "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(220 8%  8% / 0.50), transparent)",
  Anxious:   "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(142 50% 5% / 0.45), transparent)",
  Searching: "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(196 55% 6% / 0.45), transparent)",
  Tender:    "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(30  60% 6% / 0.45), transparent)",
  Hopeful:   "radial-gradient(ellipse 120% 100% at 50% 50%, hsl(270 45% 8% / 0.42), transparent)",
};

// ── Emotional typography detection ───────────────────────────────────────────
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

// ── Async typing-dot animation config ────────────────────────────────────────
const DOT_ANIM = [
  { duration: 1.15, delay: 0.0,  opacity: [0.15, 0.85, 0.15] as [number, number, number] },
  { duration: 1.65, delay: 0.35, opacity: [0.25, 1.0,  0.25] as [number, number, number] },
  { duration: 0.92, delay: 0.78, opacity: [0.1,  0.7,  0.1]  as [number, number, number] },
];

// ── Cierre tag builder (called inside component to access t()) ────────────────
const getCierreTagCats = (t: (k: string) => string) => [
  { label: t("conversation.cierreCat1"), tags: [
    t("conversation.cierreTag1_1"), t("conversation.cierreTag1_2"), t("conversation.cierreTag1_3"),
    t("conversation.cierreTag1_4"), t("conversation.cierreTag1_5"),
  ]},
  { label: t("conversation.cierreCat2"), tags: [
    t("conversation.cierreTag2_1"), t("conversation.cierreTag2_2"), t("conversation.cierreTag2_3"),
    t("conversation.cierreTag2_4"), t("conversation.cierreTag2_5"),
  ]},
  { label: t("conversation.cierreCat3"), tags: [
    t("conversation.cierreTag3_1"), t("conversation.cierreTag3_2"), t("conversation.cierreTag3_3"),
    t("conversation.cierreTag3_4"), t("conversation.cierreTag3_5"),
  ]},
  { label: t("conversation.cierreCat4"), tags: [
    t("conversation.cierreTag4_1"), t("conversation.cierreTag4_2"), t("conversation.cierreTag4_3"),
    t("conversation.cierreTag4_4"), t("conversation.cierreTag4_5"),
  ]},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─────────────────────────────────────────────────────────────────────────────
const Conversation = ({ demoCharacter }: { demoCharacter?: Character } = {}) => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { canConverse, refetch: refetchPlan } = usePlan();
  const { refetch: refetchProfile } = useUserProfile();
  const navigate = useNavigate();
  const isDemo = !!demoCharacter || id === "__intro__";

  // ── Character ─────────────────────────────────────────────────────────────
  const [character, setCharacter] = useState<Character | undefined>(
    demoCharacter ?? (id ? getCharacter(id) : undefined),
  );

  // Derive voice language from character's country; fallback to UI lang
  const charLang = character ? locationToLang(character.location) : lang;

  // ── Phase navigation ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"narrator" | "conversation">("narrator");
  const [cinemaPhase, setCinemaPhase] = useState<CinemaPhase>("entrada");
  const [viewingPhase, setViewingPhase] = useState<CinemaPhase>("entrada");

  // ── Entrada state ─────────────────────────────────────────────────────────
  const [openingText, setOpeningText] = useState<string | null>(null);
  const [typedChars, setTypedChars] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [showEnterBtn, setShowEnterBtn] = useState(false);
  const [entradaExiting, setEntradaExiting] = useState(false);

  // ── Conversación state ────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(isDemo ? 3 * 60 : 15 * 60);
  const [ended, setEnded] = useState(false);
  const [fullSession, setFullSession] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [crisisLevel, setCrisisLevel] = useState<"low" | "high" | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [deepExchangeCount, setDeepExchangeCount] = useState(0);
  const [showEmotionalPortrait, setShowEmotionalPortrait] = useState(false);
  const [emotionalPortraitShown, setEmotionalPortraitShown] = useState(false);

  // ── Cierre state ──────────────────────────────────────────────────────────
  const [closingLine, setClosingLine] = useState("");
  const [cierreTags, setCierreTags] = useState<string[]>([]);
  const [showCierreTagUI, setShowCierreTagUI] = useState(false);
  const [showCierreSkip, setShowCierreSkip] = useState(false);
  const [cierreSaving, setCierreSaving] = useState(false);

  // ── Navigation modal state ────────────────────────────────────────────────
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Resume draft modal ────────────────────────────────────────────────────
  const [pausedDraft, setPausedDraft] = useState<{
    id: string; messages: Msg[]; timeLeft: number;
  } | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);

  // ── Misc ──────────────────────────────────────────────────────────────────
  const [isResumed, setIsResumed] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [pendingTrophies, setPendingTrophies] = useState<string[]>([]);
  const [activeTrophy, setActiveTrophy] = useState<string | null>(null);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const endedRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const timeLeftRef = useRef(isDemo ? 3 * 60 : 15 * 60);
  const resumeCheckedRef = useRef(false);
  const skipSaveRef = useRef(false);

  // ── Auto-dismiss login modal on sign-in ───────────────────────────────────
  useEffect(() => { if (user && showLoginModal) setShowLoginModal(false); }, [user]);

  // ── Ref sync ──────────────────────────────────────────────────────────────
  useEffect(() => { endedRef.current = ended; }, [ended]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Ambient music ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!character) return;
    ambient.start(character.emotionalStatus as AmbientStatus);
    return () => { ambient.stop(); };
  }, [character?.emotionalStatus]);
  useEffect(() => { ambient.setMuted(musicMuted); }, [musicMuted]);

  // ── Load Firestore character ───────────────────────────────────────────────
  useEffect(() => {
    if (isDemo || character || !id) return;
    getCharacterById(id).then((c) => { if (c) setCharacter(c); });
  }, [id, isDemo]);

  // ── Check for paused conversation → show resume modal ────────────────────
  useEffect(() => {
    if (!user || !character || resumeCheckedRef.current || isDemo) return;
    resumeCheckedRef.current = true;
    getPausedConversation(user.uid, character.id).then((paused) => {
      if (!paused || paused.messages.length === 0) return;
      setPausedDraft({ id: paused.id, messages: paused.messages as Msg[], timeLeft: paused.timeLeft ?? 15 * 60 });
      setShowResumeModal(true);
    }).catch(() => {});
  }, [user, character]);

  // ── Lazy translations ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!character || lang === "en") return;
    const tl = lang as "es" | "it" | "fr";
    const existing = character.translations?.[tl];
    if (existing?.narratorStory && existing.summary && existing.longStory && existing.intro) return;
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

  // ── NarratorStory generation for Firestore chars ──────────────────────────
  useEffect(() => {
    if (!character) return;
    if (character.narratorStory) return;
    const isFirestoreChar = !characters.find((c) => c.id === character.id);
    if (!isFirestoreChar) { setPhase("conversation"); return; }
    generateNarratorStory(
      { name: character.name, age: character.age, location: character.location, longStory: character.longStory },
      [],
    ).then((story) => {
      setCharacter((c) => c ? { ...c, narratorStory: story } : c);
      saveNarratorStory(character.id, story).catch(() => {});
    }).catch(() => setPhase("conversation"));
  }, [character?.id]);

  // ── Fetch opening text for ENTRADA ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "conversation" || !character || isResumed) return;
    const tl = lang as "es" | "it" | "fr";
    const staticFallback = (lang !== "en" && character.translations?.[tl]?.intro) || character.intro;
    setOpeningText(staticFallback);
    generateDynamicOpening(character, lang)
      .then((generated) => { if (generated) setOpeningText(generated); })
      .catch(() => {});
  }, [phase, character?.id]);

  // ── Typewriter animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!openingText || phase !== "conversation" || cinemaPhase !== "entrada" || isResumed) return;
    setTypedChars(0);
    setTypingDone(false);
    setShowEnterBtn(false);
    let idx = 0;
    const iv = setInterval(() => {
      idx++;
      setTypedChars(idx);
      if (idx >= openingText.length) { clearInterval(iv); setTypingDone(true); }
    }, 50);
    return () => clearInterval(iv);
  }, [openingText, phase, cinemaPhase, isResumed]);

  // ── Show enter button 2s after typing done ────────────────────────────────
  useEffect(() => {
    if (!typingDone || showEnterBtn) return;
    const tid = setTimeout(() => setShowEnterBtn(true), 2000);
    return () => clearTimeout(tid);
  }, [typingDone]);

  // ── Create Firestore conversation when entering CONVERSACIÓN ──────────────
  useEffect(() => {
    if (cinemaPhase !== "conversacion" || !character || !user || isResumed || isDemo) return;
    if (!canConverse) { navigate("/subscribe"); return; }
    createConversation(character.id, user.uid).then((cid) => {
      setConversationId(cid);
      refetchPlan();
    }).catch(() => {});
  }, [cinemaPhase, character, user, isResumed, isDemo]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (cinemaPhase !== "conversacion" || ended) return;
    if (timeLeft <= 0) {
      setFullSession(true);
      setEnded(true);
      triggerCierre();
      return;
    }
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [cinemaPhase, ended, timeLeft]);

  // ── Emotional portrait trigger ────────────────────────────────────────────
  useEffect(() => {
    if (emotionalPortraitShown || !character?.emotionalPortraitUrl) return;
    if (cinemaPhase !== "conversacion" || !sessionStartTime) return;
    const elapsed = Date.now() - sessionStartTime;
    if (elapsed < 4 * 60_000 || elapsed > 8 * 60_000) return;
    if (deepExchangeCount < 3) return;
    setShowEmotionalPortrait(true);
    setEmotionalPortraitShown(true);
    ambient.duckForPortrait(5000);
    setTimeout(() => setShowEmotionalPortrait(false), 5000);
  }, [messages, deepExchangeCount, timeLeft, cinemaPhase]);

  // ── Drain trophy queue ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTrophy || pendingTrophies.length === 0) return;
    const [next, ...rest] = pendingTrophies;
    setActiveTrophy(next);
    setPendingTrophies(rest);
  }, [activeTrophy, pendingTrophies]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (cinemaPhase !== "conversacion" || viewingPhase !== "conversacion") return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // ── CIERRE: timer for tag UI and skip button ──────────────────────────────
  useEffect(() => {
    if (cinemaPhase !== "cierre") return;
    const t1 = setTimeout(() => setShowCierreTagUI(true), isDemo ? 1200 : 3000);
    const t2 = setTimeout(() => setShowCierreSkip(true), isDemo ? 2500 : 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cinemaPhase]);

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => () => {
    stopSpeaking();
    ambient.setDuckedForSpeaking(false);
    if (!isDemo && !skipSaveRef.current && !endedRef.current && conversationIdRef.current && messagesRef.current.length > 1) {
      pauseConversation(conversationIdRef.current, timeLeftRef.current).catch(() => {});
    }
  }, [isDemo]);

  // ── Session end: summarize, moderate, trophies ────────────────────────────
  useEffect(() => {
    if (!ended || !conversationId || !character || !user || isDemo) return;
    endConversation(conversationId).catch(() => {});
    updateStreak(user.uid).catch(() => {});
    const msgs = messagesRef.current.slice(1);
    if (msgs.filter((m) => m.role === "user").length >= 2) {
      const creatorEmail = (character as any).creatorEmail as string | undefined;
      Promise.all([
        summarizeConversation(character, msgs),
        moderateConversation(character, msgs),
      ]).then(async ([s, m]) => {
        await saveConversationSummary(conversationId, s);
        await saveConversationModeration(conversationId, m);
        if (m.decision === "deliver" && creatorEmail) {
          sendDeliveryEmail({ toEmail: creatorEmail, characterName: character.name, summary: s.summary, highlight: s.highlight, recommendations: s.recommendations }).catch(() => {});
        }
        try {
          const [existingTrophies, allConvs] = await Promise.all([getUserTrophies(user.uid), getHelperConversations(user.uid)]);
          const existingIds = new Set(existingTrophies.map((t) => t.id));
          const completedConv = { helperId: user.uid, characterId: character.id, endedAt: { toMillis: () => Date.now() } as any, startedAt: null, messages: messagesRef.current, id: conversationId, moderation: m, seenByCreator: false };
          const newIds = evaluateTrophies({ allConvs: [...allConvs, completedConv], newConv: completedConv, newScore: m.score, characterLocation: character.location, fullSession, existingTrophyIds: existingIds });
          if (newIds.length > 0) {
            await awardTrophies(user.uid, newIds);
            setPendingTrophies(newIds);
            // Notify via push for first trophy in the batch
            if (getPushPermission() === "granted") {
              const { TROPHY_DEFS } = await import("@/lib/trophies");
              const firstName = (TROPHY_DEFS as any)[newIds[0]]?.name ?? "";
              if (firstName) {
                const fns = getFunctions(app);
                httpsCallable(fns, "notifyHelperTrophy")({ helperId: user.uid, trophyName: firstName }).catch(() => {});
              }
            }
          }
          const allCompleted = [...allConvs, completedConv];
          const quality = allCompleted.filter((c) => (c.moderation?.score ?? 0) >= 7).length;
          const updatedTrophies = [...existingTrophies, ...newIds.map((id) => ({ id } as any))];
          const hasImpact = updatedTrophies.some((t) => IMPACT_TROPHY_IDS.includes(t.id));
          await setUserLevel(user.uid, calculateLevel(quality, hasImpact, false));
          rebuildWeeklyRanking().catch(() => {});
          refetchProfile();
        } catch {}
      }).catch(() => {});
    }
  }, [ended, conversationId, character, user]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const triggerCierre = () => {
    setCinemaPhase("cierre");
    setViewingPhase("cierre");
    if (character) {
      generateClosingLine(character, messagesRef.current, lang)
        .then((line) => {
          if (!line) return;
          setClosingLine(line);
          setMessages((m) => [...m, { role: "char" as const, text: line, t: now() }]);
          ambient.setDuckedForSpeaking(true);
          speakText(line, {
            characterName: character.name,
            gender: character.gender,
            emotionalStatus: character.emotionalStatus,
            lang,
            onEnd: () => { setSpeaking(false); ambient.setDuckedForSpeaking(false); },
          });
        })
        .catch(() => {});
    }
  };

  const endSession = () => {
    setEnded(true);
    triggerCierre();
  };

  const handleEnterConversacion = () => {
    if (!user && !isDemo) { setShowLoginModal(true); return; }
    if (entradaExiting) return;
    setEntradaExiting(true);
    setTimeout(() => {
      const text = openingText || character?.intro || "";
      setMessages([{ role: "char", text, t: now() }]);
      setSpeaking(true);
      ambient.setDuckedForSpeaking(true);
      speakText(text, {
        characterName: character?.name,
        gender: character?.gender,
        emotionalStatus: character?.emotionalStatus,
        lang,
        onEnd: () => { setSpeaking(false); ambient.setDuckedForSpeaking(false); },
      });
      setCinemaPhase("conversacion");
      setViewingPhase("conversacion");
      setSessionStartTime(Date.now());
      setEntradaExiting(false);
    }, 1500);
  };

  const handleResumeYes = () => {
    if (!pausedDraft) return;
    setConversationId(pausedDraft.id);
    setMessages(pausedDraft.messages);
    setTimeLeft(pausedDraft.timeLeft);
    setIsResumed(true);
    setSessionStartTime(Date.now());
    setCinemaPhase("conversacion");
    setViewingPhase("conversacion");
    setPhase("conversation");
    setShowResumeModal(false);
    setPausedDraft(null);
  };

  const handleResumeNo = () => {
    if (pausedDraft) {
      discardPausedConversation(pausedDraft.id).catch(() => {});
    }
    setShowResumeModal(false);
    setPausedDraft(null);
  };

  const handleSaveForLater = async () => {
    if (isDemo) { navigate("/gallery"); return; }
    if (isSaving) return;
    setIsSaving(true);
    if (conversationId) {
      await pauseConversation(conversationId, timeLeft).catch(() => {});
    }
    skipSaveRef.current = true;
    setIsSaving(false);
    setShowSaveConfirm(true);
    setTimeout(() => { navigate("/gallery"); }, 2800);
  };

  const handleExitConfirm = () => {
    if (isDemo) {
      navigate("/gallery");
      return;
    }
    skipSaveRef.current = true;
    navigate("/gallery");
  };

  const handleNavClick = (target: CinemaPhase) => {
    if (target === "cierre" && cinemaPhase !== "cierre") return;
    if (target === cinemaPhase) { setViewingPhase(cinemaPhase); return; }
    if (target === "entrada" && (cinemaPhase === "conversacion" || cinemaPhase === "cierre")) {
      setViewingPhase("entrada");
    } else if (target === "conversacion" && cinemaPhase === "cierre") {
      setViewingPhase("conversacion");
    } else if (viewingPhase !== cinemaPhase) {
      setViewingPhase(cinemaPhase);
    }
  };

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
      (final) => { setListening(false); setInput(final); recognizerRef.current = null; },
      () => { setListening(false); recognizerRef.current = null; },
      { lang },
    );
    recognizerRef.current = rec;
    if (rec) setListening(true);
  };

  const send = async (textOverride?: string) => {
    const msgText = (textOverride ?? input).trim();
    if (!msgText || ended || timeLeft === 0 || isTyping || !character) return;
    const userMsg: Msg = { role: "user", text: msgText, t: now() };
    setMessages((m) => [...m, userMsg]);
    if (!textOverride) setInput("");
    setIsTyping(true);

    const wordCount = msgText.split(/\s+/).filter(Boolean).length;
    const organicDelay = Math.max(3000, Math.min(8000, 1500 + wordCount * 320));

    const history = [...messages, userMsg]
      .slice(1)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));

    try {
      const [reply] = await Promise.all([
        getCharacterReply(character, history, lang),
        new Promise<void>((r) => setTimeout(r, organicDelay)),
      ]);
      const charT = now();
      const updatedMsgs = [...messages, userMsg, { role: "char" as const, text: reply, t: charT }];
      setMessages(updatedMsgs);
      if (conversationId && !isDemo) {
        await saveMessages(conversationId, [
          { role: "user", text: userMsg.text, t: userMsg.t },
          { role: "char", text: reply, t: charT },
        ]);
      }
      const replyWords = reply.split(/\s+/).filter(Boolean).length;
      if (wordCount > 15 && replyWords > 15) {
        setDeepExchangeCount((n) => n + 1);
      }
      setSpeaking(true);
      ambient.setDuckedForSpeaking(true);
      speakText(reply, {
        characterName: character.name,
        gender: character.gender,
        emotionalStatus: character.emotionalStatus,
        lang,
        onEnd: () => { setSpeaking(false); ambient.setDuckedForSpeaking(false); },
      });
      if (crisisLevel !== "high") {
        detectCrisis(updatedMsgs.slice(-8).map((m) => ({ role: m.role, text: m.text })))
          .then(({ crisis, level }) => { if (crisis) setCrisisLevel((prev) => (prev === "high" ? "high" : level)); })
          .catch(() => {});
      }
    } catch {
      setMessages((m) => [...m, { role: "char", text: "...", t: now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCierreDone = async (tags: string[]) => {
    if (isDemo) {
      navigate("/gallery");
      return;
    }
    setCierreSaving(true);
    if (conversationId && tags.length > 0) {
      await saveEmotionTags(conversationId, tags, character?.id ?? "").catch(() => {});
    }
    // Show push permission prompt if not yet granted and user is logged in
    if (user && getPushPermission() === "default") {
      setShowPushPrompt(true);
    } else {
      navigate(user ? "/profile" : "/gallery");
    }
  };

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!character) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-muted-foreground">{t("conversation.notFound")}</p>
      </div>
    );
  }

  if (phase === "narrator") {
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
        narratorText={(() => {
          const tl = lang as "es" | "it" | "fr";
          return (lang !== "en" && character.translations?.[tl]?.narratorStory) || (character.narratorStory ?? "");
        })()}
        onEnter={() => setPhase("conversation")}
      />
    );
  }

  // ── Build translated tag categories ───────────────────────────────────────
  const cierreTagCats = getCierreTagCats(t);
  const youLabel = t("conversation.youLabel") || "YOU";
  const phaseLabels: Record<CinemaPhase, string> = {
    entrada: t("conversation.phaseEntrada"),
    conversacion: t("conversation.phaseConversacion"),
    cierre: t("conversation.phaseCierre"),
  };
  const isReadMode = viewingPhase !== cinemaPhase;

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={character.portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 blur-2xl scale-110" />
        <div className="absolute inset-0 bg-background/88" />
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 4 }}
          style={{ background: ATMOSPHERE[character.emotionalStatus] ?? "" }}
        />
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center py-1.5 bg-primary/8 border-b border-primary/15">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">{t("conversation.demoNote")}</p>
          <button
            onClick={handleExitConfirm}
            className="absolute right-4 text-sm text-muted-foreground/40 hover:text-foreground/70 transition leading-none"
            aria-label="Exit demo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Resume draft modal */}
      <AnimatePresence>
        {showResumeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-3xl bg-surface border border-border/40 p-8 space-y-5 text-center"
            >
              <p className="font-display text-lg text-foreground/90">{t("conversation.resumeTitle")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("conversation.resumeBody")}</p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleResumeNo}
                  className="flex-1 rounded-full border border-border/50 py-2.5 text-sm text-muted-foreground hover:border-border hover:text-foreground transition"
                >
                  {t("conversation.resumeNo")}
                </button>
                <button
                  onClick={handleResumeYes}
                  className="flex-1 rounded-full bg-gradient-amber text-primary-foreground py-2.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
                >
                  {t("conversation.resumeYes")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirmation modal */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-3xl bg-surface border border-border/40 p-8 space-y-5 text-center"
            >
              <p className="font-display text-lg text-foreground/90">{t("conversation.confirmExitTitle")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("conversation.confirmExitBody")}</p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 rounded-full bg-gradient-amber text-primary-foreground py-2.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
                >
                  {t("conversation.confirmExitCancel")}
                </button>
                <button
                  onClick={handleExitConfirm}
                  className="flex-1 rounded-full border border-border/50 py-2.5 text-sm text-muted-foreground hover:border-border hover:text-foreground transition"
                >
                  {t("conversation.confirmExitLeave")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save confirmation toast */}
      <AnimatePresence>
        {showSaveConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] max-w-xs w-full px-5 py-3.5 rounded-2xl bg-surface border border-border/40 text-center"
          >
            <p className="text-xs text-foreground/70 leading-relaxed">{t("conversation.saveConfirm")}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase navigation bar */}
      <div className={`fixed inset-x-0 z-50 flex items-center justify-center gap-5 py-4 ${isDemo ? "top-7" : "top-0"}`}>
        {(["entrada", "conversacion", "cierre"] as CinemaPhase[]).map((p, i) => {
          const isActive = viewingPhase === p;
          const isReached = p === "entrada" || (p === "conversacion" && (cinemaPhase === "conversacion" || cinemaPhase === "cierre")) || p === cinemaPhase;
          const isClickable = !isActive && isReached && !(p === "cierre" && cinemaPhase !== "cierre");
          return (
            <div key={p} className="flex items-center gap-5">
              {i > 0 && <span className="text-[8px] text-muted-foreground/20">·</span>}
              <button
                onClick={() => isClickable && handleNavClick(p)}
                className={`text-[9px] uppercase tracking-[0.28em] transition-all ${
                  isActive ? "text-foreground/80" : isReached && isClickable ? "text-muted-foreground/35 hover:text-muted-foreground/60 cursor-pointer" : "text-muted-foreground/18 cursor-default"
                }`}
              >
                {phaseLabels[p]}
              </button>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        {/* ═══ ENTRADA ════════════════════════════════════════════════════════ */}
        {viewingPhase === "entrada" && (
          <motion.div
            key="entrada"
            className={`min-h-screen flex flex-col items-center justify-center px-6 ${isDemo ? "pt-24" : "pt-16"}`}
            animate={{ opacity: entradaExiting ? 0 : 1, scale: entradaExiting ? 0.97 : 1 }}
            transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* Portrait */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-52 md:w-64 aspect-[3/4] rounded-3xl overflow-hidden shadow-portrait mb-10"
            >
              <img src={character.portrait} alt={character.name} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-portrait" />
            </motion.div>

            {/* Opening line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="max-w-sm text-center min-h-[4rem] flex items-center justify-center"
            >
              {!openingText ? (
                <motion.span
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="inline-block h-5 w-px bg-foreground/40"
                />
              ) : (
                <p className="font-display italic text-lg md:text-xl text-foreground/85 leading-relaxed">
                  {isReadMode ? openingText : openingText.slice(0, typedChars)}
                  {!typingDone && !isReadMode && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.75, repeat: Infinity }}
                      className="inline-block w-0.5 h-[1.1em] bg-foreground/60 ml-0.5 align-middle"
                    />
                  )}
                </p>
              )}
            </motion.div>

            {/* CTA */}
            <div className="mt-12 h-10 flex items-center justify-center">
              {isReadMode ? (
                <button
                  onClick={() => setViewingPhase(cinemaPhase)}
                  className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-muted-foreground/70 border border-border/25 rounded-full px-5 py-2 hover:border-border/50 transition"
                >
                  {t("conversation.continueReading")}
                </button>
              ) : (
                <AnimatePresence>
                  {showEnterBtn && (
                    <motion.button
                      key="entrar"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.7 }}
                      onClick={handleEnterConversacion}
                      className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground/50 hover:text-muted-foreground/80 border border-border/25 rounded-full px-7 py-2.5 hover:border-border/50 transition"
                    >
                      {t("conversation.enterCTA")}
                    </motion.button>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Discrete back link in entrada */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, duration: 1 }}
              onClick={() => setShowExitModal(true)}
              className="mt-8 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/20 hover:text-muted-foreground/45 transition"
            >
              {t("conversation.backToGalleryBtn")}
            </motion.button>
          </motion.div>
        )}

        {/* ═══ CONVERSACIÓN ═══════════════════════════════════════════════════ */}
        {viewingPhase === "conversacion" && (
          <motion.div
            key="conversacion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className={`min-h-screen flex ${isDemo ? "pt-21" : "pt-14"}`}
          >
            {/* Left sidebar */}
            <aside className="w-48 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex flex-col items-center px-4 py-8 border-r border-border/15 overflow-hidden">
              <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden mb-4 shadow-portrait">
                <img src={character.portrait} alt={character.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-portrait" />
              </div>
              <h3 className="font-display text-base text-center">{character.name}</h3>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 text-center">{character.age} · {character.location}</p>
              <span className="mt-2.5 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary/80">
                {character.emotionalStatus}
              </span>
              <div className="w-full h-px bg-border/20 my-4" />
              {character.topEmotionTags && character.topEmotionTags.length > 0 && (
                <div className="flex flex-col items-center gap-1.5">
                  {character.topEmotionTags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[9px] text-muted-foreground/35 text-center">{tag}</span>
                  ))}
                </div>
              )}
            </aside>

            {/* Right column */}
            <div className="flex-1 flex flex-col min-h-[calc(100vh-3.5rem)] relative overflow-hidden">
              {/* Emotional portrait overlay */}
              <AnimatePresence>
                {showEmotionalPortrait && character.emotionalPortraitUrl && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2 }}
                    className="absolute inset-0 z-20 top-[57px]"
                  >
                    <img src={character.emotionalPortraitUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-background/20" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Header */}
              <div className="flex items-center justify-between px-8 py-3.5 border-b border-border/15 shrink-0">
                <span className={`inline-flex items-center gap-1.5 text-[10px] tabular-nums transition-colors ${
                  timeLeft <= 60 && !ended ? "text-amber-400/80" : "text-muted-foreground/40"
                }`}>
                  <Clock className="h-2.5 w-2.5" />
                  {fmt(timeLeft)}
                  {timeLeft <= 60 && !ended && (
                    <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                      <Flame className="h-2.5 w-2.5" />
                    </motion.span>
                  )}
                </span>

                <div className="flex items-center gap-4">
                  {speaking && (
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      className="text-[9px] uppercase tracking-wider text-primary/60"
                    >
                      {character.name}…
                    </motion.span>
                  )}

                  {/* Discrete nav buttons */}
                  {!ended && !isReadMode && (
                    <>
                      {!isDemo && (
                        <button
                          onClick={handleSaveForLater}
                          disabled={isSaving}
                          className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/22 hover:text-muted-foreground/50 transition disabled:opacity-30"
                        >
                          {t("conversation.saveForLater")}
                        </button>
                      )}
                      <button
                        onClick={() => isDemo ? handleExitConfirm() : setShowExitModal(true)}
                        className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/22 hover:text-muted-foreground/50 transition"
                      >
                        {t("conversation.backToGalleryBtn")}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setMusicMuted((m) => !m)}
                    className="text-muted-foreground/30 hover:text-muted-foreground/60 transition"
                    title={musicMuted ? t("conversation.musicOn") : t("conversation.musicOff")}
                  >
                    <Music className={`h-3 w-3 ${musicMuted ? "opacity-30" : ""}`} />
                  </button>

                  {!ended && !isReadMode && (
                    <button
                      onClick={endSession}
                      className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/25 hover:text-muted-foreground/50 transition"
                    >
                      {t("conversation.end")}
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 md:px-12 py-10">
                {messages.map((m, i) => {
                  const isChar = m.role === "char";
                  const charged = isChar && isEmotionallyCharged(m.text);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {i > 0 && <div className="border-t border-border/12 my-7" />}
                      <div className="space-y-2">
                        <p className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground/35">
                          {isChar ? character.name : youLabel}
                        </p>
                        <p className={`leading-relaxed ${
                          isChar
                            ? `font-display italic text-base text-foreground/85 ${charged ? "text-foreground tracking-[0.025em]" : ""}`
                            : "text-sm text-foreground/65"
                        }`}>
                          {m.text}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="border-t border-border/12 my-7" />
                    <p className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground/35 mb-3">{character.name}</p>
                    <div className="flex gap-2 items-center">
                      {DOT_ANIM.map((d, i) => (
                        <motion.span
                          key={i}
                          animate={{ opacity: d.opacity }}
                          transition={{ duration: d.duration, repeat: Infinity, delay: d.delay, ease: "easeInOut" }}
                          className="h-1.5 w-1.5 rounded-full bg-foreground/35"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {crisisLevel && <CrisisAlert level={crisisLevel} />}
                <div className="pb-8" />
              </div>

              {/* Input area */}
              {!ended && !isReadMode && (
                <div className="px-8 md:px-12 py-5 border-t border-border/10 shrink-0">
                  <div className="flex items-end gap-3">
                    {isSpeechSupported() && (
                      <motion.button
                        onClick={toggleListening}
                        animate={listening ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className={`mb-1 grid h-7 w-7 place-items-center rounded-full border transition shrink-0 ${
                          listening ? "bg-red-500/15 border-red-500/40 text-red-400" : "border-border/30 text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground"
                        }`}
                      >
                        {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                      </motion.button>
                    )}
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      rows={1}
                      disabled={listening || isTyping}
                      placeholder={listening ? t("conversation.listening") : `${t("conversation.replyTo")} ${character.name}…`}
                      className="flex-1 bg-transparent border-0 border-b border-border/20 pb-2 text-sm placeholder:text-muted-foreground/25 focus:outline-none focus:border-border/45 resize-none transition disabled:opacity-50"
                      style={{ minHeight: "2rem", maxHeight: "6rem" }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = Math.min(el.scrollHeight, 96) + "px";
                      }}
                    />
                    <button
                      onClick={() => send()}
                      disabled={!input.trim() || isTyping}
                      className="mb-1 grid h-7 w-7 place-items-center rounded-full bg-gradient-amber text-primary-foreground hover:scale-105 transition disabled:opacity-30 disabled:hover:scale-100 shrink-0"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-2 text-[9px] text-muted-foreground/25 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary/50 inline-block" />
                    {t("conversation.reviewedNote")}
                  </p>
                </div>
              )}

              {/* Read-mode return */}
              {isReadMode && (
                <div className="px-8 py-5 border-t border-border/10 shrink-0 text-center">
                  <button
                    onClick={() => setViewingPhase(cinemaPhase)}
                    className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/30 hover:text-muted-foreground/60 border border-border/20 rounded-full px-5 py-2 hover:border-border/45 transition"
                  >
                    {t("conversation.continueReading")}
                  </button>
                </div>
              )}

              {/* Session ended bar */}
              {ended && !isReadMode && (
                <div className="px-8 py-4 border-t border-border/10 shrink-0 text-center">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/25">{t("conversation.sessionEnded")}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ CIERRE ══════════════════════════════════════════════════════════ */}
        {viewingPhase === "cierre" && (
          <motion.div
            key="cierre"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 pt-16 pb-16"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1 }}
              className="text-[9px] uppercase tracking-[0.35em] text-muted-foreground/25 mb-10"
            >
              {character.name}
            </motion.p>

            <div className="max-w-xl text-center">
              {closingLine ? (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display italic text-2xl md:text-3xl text-foreground/80 leading-relaxed"
                >
                  "{closingLine}"
                </motion.p>
              ) : (
                <motion.span
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="inline-block h-5 w-px bg-foreground/30"
                />
              )}
            </div>

            {/* Emotion tag UI */}
            <AnimatePresence>
              {showCierreTagUI && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-14 w-full max-w-lg space-y-5"
                >
                  <div className="text-center">
                    <p className="text-sm text-foreground/70">{t("conversation.describeConv")}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/40">{t("conversation.chooseUpTo")}</p>
                  </div>

                  <div className="space-y-4">
                    {cierreTagCats.map((cat) => (
                      <div key={cat.label}>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">{cat.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {cat.tags.map((tag) => {
                            const active = cierreTags.includes(tag);
                            const disabled = cierreTags.length >= 2 && !active;
                            return (
                              <button
                                key={tag}
                                onClick={() => {
                                  if (disabled) return;
                                  setCierreTags((prev) =>
                                    prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
                                  );
                                }}
                                disabled={disabled}
                                className={`rounded-full px-3 py-1 text-[11px] border transition ${
                                  active
                                    ? "bg-primary/20 border-primary/50 text-primary/90"
                                    : disabled
                                    ? "border-border/15 text-muted-foreground/20 cursor-not-allowed"
                                    : "border-border/30 text-muted-foreground/50 hover:border-border/60 hover:text-foreground/70"
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

                  <div className="flex items-center justify-between pt-2">
                    <AnimatePresence>
                      {showCierreSkip && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => handleCierreDone([])}
                          className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition"
                        >
                          {t("conversation.skip")}
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => handleCierreDone(cierreTags)}
                      disabled={cierreSaving || (!isDemo && cierreTags.length === 0)}
                      className="ml-auto rounded-full bg-gradient-amber text-primary-foreground px-6 py-2 text-xs font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-30 disabled:hover:scale-100"
                    >
                      {cierreSaving ? "…" : t("conversation.saveTagsBtn")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <TrophyNotification trophyId={activeTrophy} onDismiss={() => setActiveTrophy(null)} />

      {showPushPrompt && user && (
        <PushPermissionPrompt
          uid={user.uid}
          role="helper"
          onDone={() => { setShowPushPrompt(false); navigate(user ? "/profile" : "/gallery"); }}
        />
      )}

      <AnimatePresence>
        {showLoginModal && character && (
          <LoginModal
            message={t("conversation.loginToTalk", { name: character.name })}
            onDismiss={() => setShowLoginModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NARRATOR PHASE
// ─────────────────────────────────────────────────────────────────────────────
const NarratorPhase = ({
  character,
  narratorText,
  onEnter,
}: {
  character: Character;
  narratorText: string;
  onEnter: () => void;
}) => {
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

  useEffect(() => {
    let blobUrl: string | null = null;
    fetchNarratorAudio(narratorText).then((url) => {
      blobUrl = url;
      setAudioUrl(url);
      setAudioLoading(false);
    }).catch(() => setAudioLoading(false));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [narratorText]);

  useEffect(() => {
    if (audioLoading || !audioUrl || !audioRef.current) return;
    audioRef.current.play().catch(() => {});
  }, [audioLoading, audioUrl]);

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const duration = audioRef.current.duration;
    const wordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    paragraphTimestamps.current = wordCounts.map((wc) => {
      const ts = Math.max(0, (cumulative / totalWords) * duration - 0.3);
      cumulative += wc;
      return ts;
    });
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !paragraphTimestamps.current.length) return;
    const ct = audioRef.current.currentTime;
    setRevealedCount(paragraphTimestamps.current.filter((ts) => ct >= ts).length);
  };

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
    if (audioRef.current) { audioRef.current.pause(); } else { stopSpeaking(); }
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

      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={character.portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110" />
        <div className="absolute inset-0 bg-background/88" />
        <div className="absolute inset-0" style={{ background: ATMOSPHERE[character.emotionalStatus] ?? "" }} />
      </div>

      <button
        onClick={handleEnter}
        className="fixed top-6 right-6 z-20 inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition"
      >
        {t("conversation.skip")} <ChevronRight className="h-3 w-3" />
      </button>

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

      {!audioLoading && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
          <div className="max-w-2xl w-full space-y-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
              className="flex items-center gap-4"
            >
              <img src={character.portrait} alt={character.name} className="h-14 w-14 rounded-full object-cover border border-border/40" />
              <div>
                <p className="font-display text-xl">{character.name}</p>
                <p className="text-sm text-muted-foreground">{character.age} · {character.location}</p>
              </div>
            </motion.div>

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
                    {t("conversation.meet")} {character.name}
                    <ChevronRight className="h-4 w-4" />
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

// ─────────────────────────────────────────────────────────────────────────────
// CRISIS ALERT
// ─────────────────────────────────────────────────────────────────────────────
const CrisisAlert = ({ level }: { level: "low" | "high" }) => {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`mt-8 rounded-2xl border p-4 space-y-2 ${
        level === "high" ? "bg-amber-500/10 border-amber-500/30" : "bg-primary/8 border-primary/20"
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
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Conversation;
