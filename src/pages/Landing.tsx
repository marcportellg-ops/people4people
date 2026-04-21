import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { characters } from "@/data/characters";
import { TopNav } from "@/components/TopNav";
import { TrustBadge } from "@/components/Trust";

type Side = "left" | "right" | null;

const Landing = () => {
  const [hover, setHover] = useState<Side>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Touch / pointer move
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      if (ratio < 0.45) setHover("left");
      else if (ratio > 0.55) setHover("right");
      else setHover(null);
    };
    const onLeave = () => setHover(null);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // Divider position: 50% default, 70% if hovering left (left expands), 30% if right
  const dividerLeft = hover === "left" ? "70%" : hover === "right" ? "30%" : "50%";

  const previewLeft = characters.slice(0, 5);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <TopNav />

      {/* Ambient background lights */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[600px] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div
        ref={ref}
        className="relative h-screen w-full select-none"
      >
        {/* LEFT side */}
        <motion.div
          animate={{
            width: hover === "left" ? "70%" : hover === "right" ? "30%" : "50%",
            filter: hover === "right" ? "blur(8px)" : "blur(0px)",
            opacity: hover === "right" ? 0.35 : 1,
          }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          className="absolute inset-y-0 left-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-surface" />

          {/* Gallery preview that fades in on hover */}
          <AnimatePresence>
            {hover === "left" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                <div className="absolute inset-0 grid grid-cols-3 md:grid-cols-5 gap-3 p-6 md:p-10 content-center">
                  {previewLeft.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 30, rotate: i % 2 ? -2 : 2 }}
                      animate={{ opacity: 1, y: 0, rotate: i % 2 ? -2 : 2 }}
                      transition={{ delay: 0.1 + i * 0.07, duration: 0.7 }}
                      className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-portrait"
                      style={{
                        marginTop: i % 3 === 1 ? "2rem" : 0,
                        marginBottom: i % 3 === 2 ? "2rem" : 0,
                      }}
                    >
                      <img src={c.portrait} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-portrait" />
                      <div className="absolute bottom-2 left-3 right-3">
                        <p className="font-display text-sm">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.age} · {c.tags[0]}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/70" />
              </motion.div>
            )}
          </AnimatePresence>

          <SidePanel
            side="left"
            active={hover === "left"}
            icon={<Heart className="h-4 w-4" />}
            eyebrow="For helpers"
            title="Help solve someone's problem"
            sub="Listen. Respond. Be the person you wish someone had been for you."
            href="/gallery"
            cta="Enter the gallery"
          />
        </motion.div>

        {/* RIGHT side */}
        <motion.div
          animate={{
            width: hover === "right" ? "70%" : hover === "left" ? "30%" : "50%",
            filter: hover === "left" ? "blur(8px)" : "blur(0px)",
            opacity: hover === "left" ? 0.35 : 1,
          }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          className="absolute inset-y-0 right-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-background via-background to-[hsl(25_30%_8%)]" />

          <AnimatePresence>
            {hover === "right" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                <CreatePreview />
              </motion.div>
            )}
          </AnimatePresence>

          <SidePanel
            side="right"
            active={hover === "right"}
            icon={<Sparkles className="h-4 w-4" />}
            eyebrow="For seekers"
            title="Create someone who needs help"
            sub="Turn what you're carrying into a character. Receive thoughtful responses, safely."
            href="/create"
            cta="Begin creation"
          />
        </motion.div>

        {/* Center title */}
        <AnimatePresence>
          {hover === null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-20"
            >
              <TrustBadge className="mb-6">An empathy network · No human-to-human contact</TrustBadge>
              <h1 className="font-display text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] text-gradient max-w-5xl">
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

        {/* Vertical divider */}
        <motion.div
          animate={{ left: dividerLeft }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          className="pointer-events-none absolute top-0 bottom-0 w-px z-30"
          style={{ background: "var(--gradient-divider)" }}
        >
          <motion.div
            animate={{ opacity: hover ? 0 : 1, scale: hover ? 0.6 : 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary shadow-glow"
          />
        </motion.div>
      </div>
    </div>
  );
};

const SidePanel = ({
  side,
  active,
  icon,
  eyebrow,
  title,
  sub,
  href,
  cta,
}: {
  side: "left" | "right";
  active: boolean;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  sub: string;
  href: string;
  cta: string;
}) => (
  <motion.div
    animate={{
      opacity: active ? 1 : 0.85,
      y: active ? 0 : 0,
    }}
    className={`absolute bottom-0 ${
      side === "left" ? "left-0 items-start text-left" : "right-0 items-end text-right"
    } z-30 flex flex-col p-8 md:p-14 max-w-[520px]`}
  >
    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      {icon} {eyebrow}
    </span>
    <h2 className="mt-4 font-display text-3xl md:text-5xl leading-[1.05] text-foreground max-w-md">
      {title}
    </h2>
    <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">{sub}</p>
    <Link
      to={href}
      className={`mt-6 group inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-glass/60 backdrop-blur px-5 py-3 text-sm transition-all hover:bg-secondary hover:border-primary/40 ${
        active ? "border-primary/40 bg-secondary text-foreground" : ""
      }`}
    >
      {cta}
      <ArrowRight className={`h-4 w-4 transition-transform ${side === "left" ? "group-hover:translate-x-1" : "group-hover:-translate-x-1 rotate-180"}`} />
    </Link>
  </motion.div>
);

const CreatePreview = () => (
  <div className="absolute inset-0 flex items-center justify-end p-10">
    <div className="w-full max-w-md space-y-3">
      {[
        "Tell us what happened.",
        "Who is this person?",
        "What hurts most?",
        "Choose a face that feels right.",
      ].map((s, i) => (
        <motion.div
          key={s}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.1, duration: 0.6 }}
          className="glass rounded-2xl p-4 flex items-center gap-3"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-amber text-xs text-primary-foreground font-medium">
            {i + 1}
          </span>
          <p className="font-display text-base">{s}</p>
        </motion.div>
      ))}
    </div>
    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/70" />
  </div>
);

export default Landing;
