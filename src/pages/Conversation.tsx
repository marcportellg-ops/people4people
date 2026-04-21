import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mic, Send, Square, ShieldCheck, Clock } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TrustBadge } from "@/components/Trust";
import { getCharacter } from "@/data/characters";

type Msg = { role: "char" | "user"; text: string; t: string };

const sampleResponses: Record<string, string[]> = {
  default: [
    "Thank you. That actually means more than you know.",
    "I think I needed someone to just say that out loud.",
    "I haven't told that to anyone. Even saying it now is heavy.",
    "Can I sit with that for a second? I want to give you a real answer.",
  ],
};

const Conversation = () => {
  const { id } = useParams();
  const character = id ? getCharacter(id) : undefined;
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [ended, setEnded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!character) return;
    const t0 = setTimeout(() => {
      setMessages([{ role: "char", text: character.intro, t: now() }]);
    }, 600);
    return () => clearTimeout(t0);
  }, [character]);

  useEffect(() => {
    if (ended) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [ended]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  if (!character) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-muted-foreground">Character not found.</p>
      </div>
    );
  }

  const send = () => {
    if (!input.trim() || ended) return;
    const userMsg: Msg = { role: "user", text: input.trim(), t: now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      const replies = sampleResponses.default;
      const reply = replies[Math.floor(Math.random() * replies.length)];
      setMessages((m) => [...m, { role: "char", text: reply, t: now() }]);
      setIsTyping(false);
    }, 1400 + Math.random() * 800);
  };

  const endSession = () => setEnded(true);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <TopNav />

      {/* Ambient portrait backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img
          src={character.portrait}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-2xl scale-110"
        />
        <div className="absolute inset-0 bg-background/85" />
      </div>

      <div className="container pt-24 pb-12 grid lg:grid-cols-[420px_1fr] gap-8">
        {/* Portrait & info */}
        <aside className="lg:sticky lg:top-24 self-start space-y-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to gallery
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
            <p className="text-muted-foreground leading-relaxed">{character.longStory}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {character.tags.map((t) => (
                <span key={t} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <TrustBadge>Conversation moderated · Voice anonymized</TrustBadge>
        </aside>

        {/* Chat */}
        <section className="flex flex-col h-[calc(100vh-8rem)] glass-strong rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm">Safe session with {character.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Clock className="h-3 w-3" /> {fmt(seconds)}
              </span>
              {!ended && (
                <button
                  onClick={endSession}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs hover:border-destructive/60 hover:text-destructive transition"
                >
                  End session
                </button>
              )}
            </div>
          </div>

          {/* Transcript */}
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
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1">
                      {m.role === "user" ? "You" : character.name} · {m.t}
                    </span>
                    <div
                      className={`rounded-2xl px-4 py-3 leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary/15 text-foreground border border-primary/20 rounded-br-sm"
                          : "bg-surface-elevated/80 border border-border/60 rounded-bl-sm"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </motion.div>
              ))}
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

            {ended && <EndState character={character.name} />}
          </div>

          {/* Input */}
          {!ended && (
            <div className="border-t border-border/40 p-4 bg-surface/40">
              <div className="flex items-center gap-2">
                <button className="grid h-11 w-11 place-items-center rounded-full bg-secondary border border-border/60 hover:border-primary/40 transition" aria-label="Voice">
                  <Mic className="h-4 w-4" />
                </button>
                <div className="flex-1 relative">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={`Reply to ${character.name}…`}
                    className="w-full rounded-full bg-surface border border-border px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition"
                  />
                </div>
                <button
                  onClick={send}
                  className="grid h-11 w-11 place-items-center rounded-full bg-gradient-amber text-primary-foreground shadow-glow hover:scale-105 transition"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/80 px-2 flex items-center gap-2">
                <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse" /> Live transcription on · Reviewed before delivery
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const EndState = ({ character }: { character: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8 }}
    className="mt-10 mx-auto max-w-md text-center space-y-4 py-10"
  >
    <div className="mx-auto h-12 w-12 rounded-full bg-gradient-amber grid place-items-center shadow-glow">
      <ShieldCheck className="h-5 w-5 text-primary-foreground" />
    </div>
    <h3 className="font-display text-3xl">Thank you for showing up.</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Your conversation with {character} will be reviewed by our moderation team and shared safely
      with the original creator within 24 hours. Their identity stays protected. So does yours.
    </p>
    <Link
      to="/gallery"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm hover:border-primary/40 transition"
    >
      Return to the gallery
    </Link>
  </motion.div>
);

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default Conversation;
