import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { characters } from "@/data/characters";
import { TopNav } from "@/components/TopNav";
import { TrustBadge } from "@/components/Trust";

type Side = "left" | "right" | null;

const Landing = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<Side>(null);
  const [inside, setInside] = useState(false);

  // Raw cursor position (0–1 ratio of container width)
  const cursorRaw = useMotionValue(0.5);

  // Spring-physics smoothing — the divider lags slightly behind the cursor
  const cursor = useSpring(cursorRaw, { stiffness: 130, damping: 26, mass: 0.7 });

  // Derived motion values
  const leftWidth  = useTransform(cursor, [0, 1], ["20%", "80%"]);
  const rightWidth = useTransform(cursor, [0, 1], ["80%", "20%"]);
  const divLeft    = useTransform(cursor, [0, 1], ["20%", "80%"]);

  // Fade inactive side as cursor moves toward the active side
  const leftOpacity  = useTransform(cursor, [0.25, 0.5, 0.75], [1, 0.85, 0.28]);
  const rightOpacity = useTransform(cursor, [0.25, 0.5, 0.75], [0.28, 0.85, 1]);
  const leftBlur     = useTransform(cursor, [0.45, 0.72], ["blur(0px)", "blur(9px)"]);
  const rightBlur    = useTransform(cursor, [0.28, 0.55], ["blur(9px)", "blur(0px)"]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0.18, Math.min(0.82, (e.clientX - rect.left) / rect.width));
      cursorRaw.set(ratio);
      setSide(ratio < 0.42 ? "left" : ratio > 0.58 ? "right" : null);
    };
    const onEnter = () => setInside(true);
    const onLeave = () => {
      setInside(false);
      setSide(null);
      cursorRaw.set(0.5);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [cursorRaw]);

  const previewChars = characters.slice(0, 5);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <TopNav />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/8 blur-[160px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[600px] rounded-full bg-accent/8 blur-[130px]" />
      </div>

      {/* ─── Mobile layout ─────────────────────────────────────── */}
      <div className="flex flex-col md:hidden min-h-screen pt-24 pb-12 px-6 gap-6 items-center justify-center">
        <TrustBadge>An empathy network · No human-to-human contact</TrustBadge>
        <h1 className="font-display text-5xl text-gradient text-center leading-[0.97] mt-4">
          Now it's your turn<br />to decide.
        </h1>
        <p className="text-center text-sm text-muted-foreground max-w-xs mt-2">
          Help someone carry their problem — or create a character from your own.
        </p>
        <div className="mt-4 flex flex-col gap-3 w-full max-w-xs">
          <Link to="/gallery" className="flex items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-sm hover:border-primary/40 transition">
            <span className="flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Help someone</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link to="/create" className="flex items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-sm hover:border-primary/40 transition">
            <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Be heard</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* ─── Desktop split-screen ──────────────────────────────── */}
      <div ref={ref} className="hidden md:block relative h-screen w-full select-none">

        {/* LEFT panel */}
        <motion.div
          style={{ width: leftWidth, opacity: leftOpacity, filter: leftBlur }}
          className="absolute inset-y-0 left-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-surface" />

          {/* Character portraits fan */}
          <AnimatePresence>
            {side === "left" && (
              <motion.div
                key="gallery-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <div className="absolute inset-0 flex items-center justify-start pl-12 gap-3 overflow-hidden">
                  {previewChars.map((c, i) => {
                    const offsets = ["-4deg", "2deg", "-2deg", "3deg", "-3deg"];
                    const tops = ["8%", "18%", "5%", "14%", "10%"];
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 40, rotate: parseFloat(offsets[i]) - 4 }}
                        animate={{ opacity: 1, y: 0, rotate: parseFloat(offsets[i]) }}
                        transition={{ delay: 0.08 + i * 0.08, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                        className="relative shrink-0 rounded-2xl overflow-hidden shadow-portrait"
                        style={{
                          width: i === 2 ? "140px" : "115px",
                          aspectRatio: "3/4",
                          marginTop: tops[i],
                        }}
                      >
                        <img src={c.portrait} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-portrait" />
                        <div className="absolute bottom-2 left-2.5 right-2.5">
                          <p className="font-display text-xs leading-tight">{c.name}</p>
                          <p className="text-[9px] text-muted-foreground">{c.age} · {c.tags[0]}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/80" />
              </motion.div>
            )}
          </AnimatePresence>

          <SideContent
            side="left"
            active={side === "left"}
            icon={<Heart className="h-4 w-4" />}
            eyebrow="For helpers"
            title={<>Help solve<br />someone's problem</>}
            sub="Listen. Respond. Be the person you wish someone had been for you."
            href="/gallery"
            cta="Enter the gallery"
          />
        </motion.div>

        {/* RIGHT panel */}
        <motion.div
          style={{ width: rightWidth, opacity: rightOpacity, filter: rightBlur }}
          className="absolute inset-y-0 right-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-background via-background to-[hsl(25_30%_8%)]" />

          <AnimatePresence>
            {side === "right" && (
              <motion.div
                key="create-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <CreatePreview />
              </motion.div>
            )}
          </AnimatePresence>

          <SideContent
            side="right"
            active={side === "right"}
            icon={<Sparkles className="h-4 w-4" />}
            eyebrow="For seekers"
            title={<>Create someone<br />who needs help</>}
            sub="Turn what you're carrying into a character. Receive thoughtful responses, safely."
            href="/create"
            cta="Begin creation"
          />
        </motion.div>

        {/* Center title — fades when cursor moves */}
        <AnimatePresence>
          {!inside && (
            <motion.div
              key="center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-20"
            >
              <TrustBadge className="mb-6">An empathy network · No human-to-human contact</TrustBadge>
              <h1 className="font-display text-[clamp(2.8rem,7vw,6rem)] leading-[0.95] text-gradient max-w-5xl">
                Now it's your turn<br />to decide.
              </h1>
              <p className="mt-6 max-w-md text-sm md:text-base text-muted-foreground">
                Move left to help. Move right to be heard.
              </p>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="mt-10 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70"
              >
                ◂ choose a side ▸
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated divider line */}
        <motion.div
          style={{ left: divLeft }}
          className="pointer-events-none absolute inset-y-0 w-px z-30"
        >
          {/* Glow behind the line */}
          <div
            className="absolute inset-y-0 w-px"
            style={{ background: "var(--gradient-divider)" }}
          />
          <div
            className="absolute inset-y-0 -left-2 w-5 opacity-30"
            style={{ background: "radial-gradient(ellipse 10px 100% at 50% 50%, hsl(40 60% 70% / 0.35), transparent)" }}
          />
          {/* Center dot — fades when cursor moves off center */}
          <motion.div
            animate={{ opacity: side ? 0 : 1, scale: side ? 0.5 : 1 }}
            transition={{ duration: 0.35 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary shadow-glow"
          />
        </motion.div>
      </div>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const SideContent = ({
  side, active, icon, eyebrow, title, sub, href, cta,
}: {
  side: "left" | "right";
  active: boolean;
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  href: string;
  cta: string;
}) => (
  <motion.div
    animate={{ opacity: active ? 1 : 0.75, y: active ? 0 : 6 }}
    transition={{ duration: 0.5 }}
    className={`absolute bottom-0 z-30 flex flex-col p-8 md:p-14 max-w-[520px] ${
      side === "left" ? "left-0 items-start text-left" : "right-0 items-end text-right"
    }`}
  >
    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      {icon} {eyebrow}
    </span>
    <h2 className="mt-4 font-display text-3xl md:text-5xl leading-[1.02] text-foreground max-w-md">
      {title}
    </h2>
    <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">{sub}</p>
    <Link
      to={href}
      className={`mt-6 group inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-glass/60 backdrop-blur px-5 py-3 text-sm transition-all hover:bg-secondary hover:border-primary/40 ${
        active ? "border-primary/40 bg-secondary" : ""
      }`}
    >
      {side === "right" && <ArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />}
      {cta}
      {side === "left" && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
    </Link>
  </motion.div>
);

const CreatePreview = () => (
  <div className="absolute inset-0 flex items-center justify-end pr-12">
    <div className="w-full max-w-sm space-y-2.5">
      {[
        { n: 1, label: "Tell us what happened." },
        { n: 2, label: "We'll ask you a few questions." },
        { n: 3, label: "Choose a face that feels right." },
        { n: 4, label: "Publish. Receive help safely." },
      ].map(({ n, label }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 + i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-amber text-xs text-primary-foreground font-medium shadow-glow">
            {n}
          </span>
          <p className="font-display text-sm">{label}</p>
        </motion.div>
      ))}
    </div>
    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/75 pointer-events-none" />
  </div>
);

export default Landing;
