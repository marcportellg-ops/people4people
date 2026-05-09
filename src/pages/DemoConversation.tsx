import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronRight, Clock, Mic, MicOff, Send, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { INTRO_CHARACTER } from "@/data/introCharacter";
import { getCharacterReply, detectCrisis, generateDynamicOpening } from "@/lib/claude";
import { markOnboarded } from "@/lib/db";
import { isSpeechSupported, startRecognition, speakText, stopSpeaking, fetchNarratorAudio } from "@/lib/voice";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUserProfile } from "@/context/UserProfileContext";
import type { Language } from "@/lib/translations";

type Msg = { role: "char" | "user"; text: string; t: string };

const DEMO_END: Record<Language, { title: string; body: string; cta: string; sub: string }> = {
  es: {
    title: "Acabas de experimentar lo que recibe alguien real.",
    body: "¿Quieres ayudar a más personas como esta?",
    cta: "Ir a la galería",
    sub: "Cada personaje en la galería es una historia real esperando a alguien como tú.",
  },
  en: {
    title: "You just experienced what a real person receives.",
    body: "Do you want to help more people like this?",
    cta: "Go to the gallery",
    sub: "Every character in the gallery is a real story waiting for someone like you.",
  },
  fr: {
    title: "Vous venez de vivre ce que reçoit une vraie personne.",
    body: "Voulez-vous aider d'autres personnes comme celle-ci ?",
    cta: "Aller à la galerie",
    sub: "Chaque personnage de la galerie est une histoire vraie qui attend quelqu'un comme vous.",
  },
  it: {
    title: "Hai appena vissuto quello che riceve una persona reale.",
    body: "Vuoi aiutare altre persone come questa?",
    cta: "Vai alla galleria",
    sub: "Ogni personaggio nella galleria è una storia reale che aspetta qualcuno come te.",
  },
};

const DEMO_DURATION = 180; // 3 minutes

const SUGGESTIONS: Record<Language, { label: string; prompts: string[] }> = {
  es: {
    label: "Puedes escribir algo como…",
    prompts: [
      "¿Cómo fue eso para ti?",
      "Estoy aquí para escucharte.",
      "Cuéntame más sobre esa mañana.",
      "¿Qué sentiste cuando lo viste?",
    ],
  },
  en: {
    label: "Try saying something like…",
    prompts: [
      "What was that like for you?",
      "I'm here to listen.",
      "Tell me more about that morning.",
      "What did you feel when you saw it?",
    ],
  },
  fr: {
    label: "Vous pouvez écrire quelque chose comme…",
    prompts: [
      "Comment c'était pour vous ?",
      "Je suis là pour vous écouter.",
      "Parlez-moi de ce matin-là.",
      "Qu'avez-vous ressenti en le voyant ?",
    ],
  },
  it: {
    label: "Puoi scrivere qualcosa come…",
    prompts: [
      "Com'è stato per te?",
      "Sono qui per ascoltarti.",
      "Dimmi di più di quella mattina.",
      "Cosa hai provato quando l'hai visto?",
    ],
  },
};

const DemoConversation = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { setOnboardedTrue } = useUserProfile();
  const navigate = useNavigate();
  const character = INTRO_CHARACTER;

  const [phase, setPhase] = useState<"narrator" | "chat">("narrator");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(DEMO_DURATION);
  const [ended, setEnded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [crisisLevel, setCrisisLevel] = useState<"low" | "high" | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const endedRef = useRef(false);

  useEffect(() => { endedRef.current = ended; }, [ended]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Show opening message when entering chat phase
  useEffect(() => {
    if (phase !== "chat") return;
    let cancelled = false;

    const show = async () => {
      const tl = lang as "es" | "it" | "fr";
      const staticFallback =
        (lang !== "en" && character.translations?.[tl]?.intro) || character.intro;
      let introText = staticFallback;
      try {
        const generated = await generateDynamicOpening(character, lang);
        if (generated) introText = generated;
      } catch { /* keep fallback */ }

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

    const timer = setTimeout(show, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, lang]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "chat" || ended) return;
    if (timeLeft <= 0) { setEnded(true); return; }
    const i = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [phase, ended, timeLeft]);

  // Stop audio on unmount
  useEffect(() => () => { stopSpeaking(); }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

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
    if (!msgText || ended || timeLeft === 0 || isTyping) return;
    const userMsg: Msg = { role: "user", text: msgText, t: now() };
    setMessages((m) => [...m, userMsg]);
    if (!textOverride) setInput("");
    setIsTyping(true);

    const history = [...messages, userMsg]
      .slice(1)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));

    try {
      const reply = await getCharacterReply(character, history, lang);
      const charT = now();
      const updated = [...messages, userMsg, { role: "char" as const, text: reply, t: charT }];
      setMessages(updated);
      const replyIdx = updated.length - 1;
      // No saveMessages — demo is ephemeral
      setSpeaking(true);
      setSpeakingMsgIdx(replyIdx);
      speakText(reply, {
        characterName: character.name,
        gender: character.gender,
        emotionalStatus: character.emotionalStatus,
        onEnd: () => { setSpeaking(false); setSpeakingMsgIdx(null); },
      });
      if (crisisLevel !== "high") {
        detectCrisis(updated.slice(-8).map((m) => ({ role: m.role, text: m.text })))
          .then(({ crisis, level }) => { if (crisis) setCrisisLevel((p) => p === "high" ? "high" : level); })
          .catch(() => {});
      }
    } catch {
      setMessages((m) => [...m, { role: "char", text: "Sorry, I couldn't respond right now.", t: now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGoGallery = async () => {
    if (user) await markOnboarded(user.uid).catch(() => {});
    setOnboardedTrue();
    navigate("/gallery");
  };

  // Narrator phase
  if (phase === "narrator") {
    const tl = lang as "es" | "it" | "fr";
    const narratorText =
      (lang !== "en" && character.translations?.[tl]?.narratorStory) ||
      (character.narratorStory ?? "");
    return (
      <DemoNarrator
        character={character}
        narratorText={narratorText}
        onEnter={() => setPhase("chat")}
        skipLabel={t("conversation.skip")}
        enterLabel={`${t("conversation.meet")} ${character.name}`}
        preparingLabel={`${t("conversation.preparing")} ${character.name}${t("conversation.storySuffix")}`}
      />
    );
  }

  const endText = DEMO_END[lang] ?? DEMO_END.es;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={character.portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-2xl scale-110" />
        <div className="absolute inset-0 bg-background/85" />
      </div>

      {/* Demo banner */}
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center py-2 bg-primary/10 border-b border-primary/20">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">
          {lang === "es" ? "Conversación de prueba · Sin guardar" :
           lang === "fr" ? "Conversation de démo · Non enregistrée" :
           lang === "it" ? "Conversazione demo · Non salvata" :
           "Demo conversation · Not saved"}
        </p>
      </div>

      <div className="container pt-16 pb-12 grid lg:grid-cols-[420px_1fr] gap-8">
        {/* Portrait & info */}
        <aside className="lg:sticky lg:top-20 self-start space-y-5">
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
            <div className="absolute top-3 left-3">
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

          <div className="glass rounded-2xl p-4 text-sm">
            <p className="text-muted-foreground leading-relaxed">
              {(lang !== "en" && character.translations?.[lang as "es"|"it"|"fr"]?.longStory) || character.longStory}
            </p>
          </div>
        </aside>

        {/* Chat */}
        <section className="flex flex-col h-[calc(100vh-5rem)] glass-strong rounded-3xl overflow-hidden">
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
              <span className={`inline-flex items-center gap-1.5 text-xs tabular-nums transition ${timeLeft <= 120 && !ended ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                <Clock className="h-3 w-3" /> {fmt(timeLeft)}
              </span>
              {isSpeechSupported() && !ended && (
                <button
                  onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); if (!next) stopSpeaking(); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${voiceEnabled ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/30"}`}
                >
                  {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  {voiceEnabled ? t("conversation.voiceOn") : t("conversation.voiceOff")}
                </button>
              )}
              {!ended && (
                <button
                  onClick={() => setEnded(true)}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs hover:border-destructive/60 hover:text-destructive transition"
                >
                  {t("conversation.endSession")}
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-8 py-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
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
                    <div className={`rounded-2xl px-4 py-3 leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary/15 text-foreground border border-primary/20 rounded-br-sm"
                        : "bg-surface-elevated/80 border border-border/60 rounded-bl-sm"
                    } ${speakingMsgIdx === i ? "ring-1 ring-primary/30" : ""}`}>
                      {m.text}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Suggestion chips — visible only before user sends first message */}
            <AnimatePresence>
              {messages.length === 1 && !ended && !isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="pt-2 space-y-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60 text-center">
                    {(SUGGESTIONS[lang] ?? SUGGESTIONS.en).label}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(SUGGESTIONS[lang] ?? SUGGESTIONS.en).prompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="rounded-full border border-border/60 bg-surface/60 px-4 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-surface transition"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-surface-elevated/80 border border-border/60 px-4 py-3 inline-flex gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.15 }} className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                  ))}
                </div>
              </motion.div>
            )}

            {crisisLevel && <DemoCrisisAlert level={crisisLevel} />}

            {/* Demo end state */}
            {ended && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="mt-10 mx-auto max-w-md text-center space-y-5 py-10"
              >
                <div className="mx-auto h-14 w-14 rounded-full bg-gradient-amber grid place-items-center shadow-glow">
                  <ShieldCheck className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display text-2xl leading-tight">{endText.title}</h3>
                  <p className="mt-2 text-base text-muted-foreground">{endText.body}</p>
                </div>
                <button
                  onClick={handleGoGallery}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-7 py-3.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
                >
                  {endText.cta} <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">{endText.sub}</p>
              </motion.div>
            )}
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
                  className={`grid h-11 w-11 place-items-center rounded-full border transition ${listening ? "bg-red-500/20 border-red-500/60 text-red-400" : "bg-secondary border-border/60 hover:border-primary/40"} disabled:opacity-40`}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </motion.button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(undefined)}
                  disabled={listening}
                  placeholder={listening ? t("conversation.listening") : `${t("conversation.replyTo")} ${character.name}…`}
                  className={`flex-1 rounded-full bg-surface border px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition ${listening ? "border-red-500/40 text-muted-foreground italic" : "border-border"}`}
                />
                <button
                  onClick={() => send(undefined)}
                  className="grid h-11 w-11 place-items-center rounded-full bg-gradient-amber text-primary-foreground shadow-glow hover:scale-105 transition"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {(ended || timeLeft === 0) && !ended && (
            <div className="border-t border-border/40 p-5 text-center">
              <p className="text-sm font-medium">{t("conversation.sessionEnded")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// ─── Narrator component (self-contained for demo) ────────────────────────────

type DemoNarratorProps = {
  character: typeof INTRO_CHARACTER;
  narratorText: string;
  onEnter: () => void;
  skipLabel: string;
  enterLabel: string;
  preparingLabel: string;
};

const DemoNarrator = ({ character, narratorText, onEnter, skipLabel, enterLabel, preparingLabel }: DemoNarratorProps) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const [revealedCount, setRevealedCount] = useState(0);
  const [narrationDone, setNarrationDone] = useState(false);
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
    const total = wordCounts.reduce((a, b) => a + b, 0);
    let cum = 0;
    paragraphTimestamps.current = wordCounts.map((wc) => {
      const ts = Math.max(0, (cum / total) * duration - 0.3);
      cum += wc;
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
    timersRef.current.forEach(clearTimeout);
    if (audioRef.current) audioRef.current.pause();
    else stopSpeaking();
    onEnter();
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onEnded={() => setNarrationDone(true)} />
      )}

      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={character.portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110" />
        <div className="absolute inset-0 bg-background/88" />
      </div>

      <button onClick={handleEnter} className="fixed top-6 right-6 z-20 inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition">
        {skipLabel} <ChevronRight className="h-3 w-3" />
      </button>

      {audioLoading && (
        <div className="flex-1 flex items-center justify-center">
          <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-sm text-muted-foreground tracking-wide">
            {preparingLabel}
          </motion.p>
        </div>
      )}

      {!audioLoading && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
          <div className="max-w-2xl w-full space-y-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} className="flex items-center gap-4">
              <img src={character.portrait} alt={character.name} className="h-14 w-14 rounded-full object-cover border border-border/40" />
              <div>
                <p className="font-display text-xl">{character.name}</p>
                <p className="text-sm text-muted-foreground">{character.age} · {character.location}</p>
              </div>
            </motion.div>

            <div className="space-y-6">
              <AnimatePresence>
                {paragraphs.slice(0, revealedCount).map((p, i) => (
                  <motion.p key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="text-lg leading-relaxed text-foreground/80 font-light">
                    {p}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {narrationDone && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                  <button onClick={handleEnter} className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-7 py-3.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition">
                    {enterLabel} <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

const DemoCrisisAlert = ({ level }: { level: "low" | "high" }) => {
  const { t } = useLanguage();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className={`rounded-2xl border p-4 space-y-2 ${level === "high" ? "bg-amber-500/10 border-amber-500/30" : "bg-primary/8 border-primary/20"}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-base">{level === "high" ? "🟠" : "🔵"}</span>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{level === "high" ? t("conversation.crisis.high") : t("conversation.crisis.low")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{level === "high" ? t("conversation.crisis.highSub") : t("conversation.crisis.lowSub")}</p>
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

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default DemoConversation;
