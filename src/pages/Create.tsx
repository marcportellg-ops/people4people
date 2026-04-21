import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Mic, RefreshCw, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TrustBadge } from "@/components/Trust";
import { characters } from "@/data/characters";

type Step = 0 | 1 | 2 | 3;

const profilingQuestions = [
  "Who is this person?",
  "What is their age range?",
  "What happened?",
  "What hurts the most?",
  "What are they afraid of?",
  "How do they react under stress?",
  "What kind of help do they need?",
];

const Create = () => {
  const [step, setStep] = useState<Step>(0);
  const [story, setStory] = useState("");
  const [answers, setAnswers] = useState<string[]>(Array(profilingQuestions.length).fill(""));
  const [qIndex, setQIndex] = useState(0);
  const [selectedPortrait, setSelectedPortrait] = useState<string | null>(null);
  const [rehearsalMsgs, setRehearsalMsgs] = useState<{ role: "user" | "char"; text: string }[]>([]);
  const [rehearsalInput, setRehearsalInput] = useState("");

  const portraits = characters.slice(0, 6).map((c) => c.portrait);

  return (
    <div className="min-h-screen pb-24">
      <TopNav />
      <div className="container pt-32 max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-3">
          {["The story", "The person", "Their face", "Rehearse"].map((label, i) => (
            <div key={label} className="flex-1 flex items-center gap-3">
              <div
                className={`flex items-center gap-2 ${
                  i === step ? "text-foreground" : i < step ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs border transition ${
                    i === step
                      ? "bg-gradient-amber text-primary-foreground border-transparent shadow-glow"
                      : i < step
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline text-xs uppercase tracking-wider">{label}</span>
              </div>
              {i < 3 && <div className={`h-px flex-1 ${i < step ? "bg-primary/40" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <StepWrap key="0">
              <Eyebrow>Step 01 · The story</Eyebrow>
              <h1 className="font-display text-5xl md:text-6xl text-gradient leading-[1.05] mt-3">
                Tell us what<br />happened.
              </h1>
              <p className="mt-5 text-muted-foreground max-w-xl">
                There's no right way to start. Write it the way it lives inside you — messy, unfinished, raw.
                Only you and our quiet moderation will read it.
              </p>
              <div className="mt-8 glass-strong rounded-3xl p-2">
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  rows={9}
                  placeholder="It started about three months ago, when…"
                  className="w-full bg-transparent rounded-2xl p-5 text-base leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <button className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition">
                    <Mic className="h-3.5 w-3.5" /> Speak it instead
                  </button>
                  <span className="text-xs text-muted-foreground">{story.length} characters</span>
                </div>
              </div>
              <TrustBadge className="mt-6">Encrypted · Never linked to your real identity</TrustBadge>
              <Footer
                onNext={() => setStep(1)}
                disabled={story.trim().length < 12}
              />
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap key="1">
              <Eyebrow>Step 02 · The person</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl text-gradient leading-[1.05] mt-3">
                Let's give them a shape.
              </h1>
              <p className="mt-4 text-muted-foreground max-w-xl">
                A few quiet questions. Skip anything that doesn't fit.
              </p>

              <div className="mt-8 glass-strong rounded-3xl p-6 md:p-8">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Question {qIndex + 1} of {profilingQuestions.length}
                </div>
                <motion.h3
                  key={qIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 font-display text-3xl"
                >
                  {profilingQuestions[qIndex]}
                </motion.h3>
                <textarea
                  value={answers[qIndex]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[qIndex] = e.target.value;
                    setAnswers(next);
                  }}
                  rows={4}
                  placeholder="Type your answer…"
                  className="mt-5 w-full bg-surface/60 border border-border rounded-2xl p-4 text-base focus:outline-none focus:border-primary/50 resize-none transition"
                />
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                    disabled={qIndex === 0}
                    className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                  >
                    ← Previous
                  </button>
                  {qIndex < profilingQuestions.length - 1 ? (
                    <button
                      onClick={() => setQIndex((i) => i + 1)}
                      className="rounded-full bg-secondary border border-border/60 px-4 py-2 text-sm hover:border-primary/40 transition"
                    >
                      Next question →
                    </button>
                  ) : (
                    <span className="text-xs text-primary">All set ✦</span>
                  )}
                </div>
              </div>
              <Footer onBack={() => setStep(0)} onNext={() => setStep(2)} />
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap key="2">
              <Eyebrow>Step 03 · Their face</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl text-gradient leading-[1.05] mt-3">
                Choose the face that<br />feels true.
              </h1>
              <p className="mt-4 text-muted-foreground max-w-xl">
                You can refine until the face matches the voice you hear in your mind.
              </p>

              <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                {portraits.map((p, i) => {
                  const active = selectedPortrait === p;
                  return (
                    <motion.button
                      key={i}
                      onClick={() => setSelectedPortrait(p)}
                      whileHover={{ y: -4 }}
                      className={`group relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${
                        active ? "border-primary shadow-glow" : "border-transparent hover:border-border"
                      }`}
                    >
                      <img src={p} alt="Portrait option" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-portrait" />
                      {active && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground"
                        >
                          <Check className="h-4 w-4" />
                        </motion.div>
                      )}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="text-xs">Option {i + 1}</span>
                        <button className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 rounded-full glass px-2 py-1 text-[10px] transition">
                          <RefreshCw className="h-3 w-3" /> More like this
                        </button>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
                  <Sparkles className="h-4 w-4" /> Generate new round
                </button>
                <span className="text-xs text-muted-foreground">Round 1 of unlimited</span>
              </div>

              <Footer
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                disabled={!selectedPortrait}
                nextLabel="Select this person"
              />
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap key="3">
              <Eyebrow>Step 04 · Rehearse</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl text-gradient leading-[1.05] mt-3">
                Talk to them, privately.
              </h1>
              <p className="mt-4 text-muted-foreground max-w-xl">
                Refine their tone, what they remember, how they react. When it feels right, publish.
              </p>

              <div className="mt-8 grid lg:grid-cols-[260px_1fr] gap-5">
                <div className="space-y-4">
                  {selectedPortrait && (
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-portrait">
                      <img src={selectedPortrait} alt="Selected character" className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-portrait" />
                      <div className="absolute bottom-3 left-3">
                        <p className="font-display text-lg">Untitled</p>
                        <p className="text-[10px] text-muted-foreground">Draft character</p>
                      </div>
                    </div>
                  )}
                  <div className="glass rounded-2xl p-4 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Refine</p>
                    {["Tone", "Memory", "Reactions", "Background"].map((c) => (
                      <button key={c} className="w-full text-left text-sm rounded-lg border border-border/60 px-3 py-2 hover:border-primary/40 transition">
                        {c} →
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-strong rounded-3xl flex flex-col h-[520px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Private rehearsal · Not visible to anyone</span>
                    <TrustBadge>Draft mode</TrustBadge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {rehearsalMsgs.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center mt-20">
                        Say hello. See if they sound like the person you imagined.
                      </p>
                    )}
                    {rehearsalMsgs.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          m.role === "user"
                            ? "bg-primary/15 border border-primary/20 rounded-br-sm"
                            : "bg-surface-elevated/80 border border-border/60 rounded-bl-sm"
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border/40 p-3 flex gap-2">
                    <input
                      value={rehearsalInput}
                      onChange={(e) => setRehearsalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && rehearsalInput.trim()) {
                          const text = rehearsalInput.trim();
                          setRehearsalMsgs((m) => [...m, { role: "user", text }]);
                          setRehearsalInput("");
                          setTimeout(() => {
                            setRehearsalMsgs((m) => [...m, { role: "char", text: "I'm here. Tell me more — I want to feel the shape of it." }]);
                          }, 900);
                        }
                      }}
                      placeholder="Test a line…"
                      className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={() => setStep(2)} className="text-sm text-muted-foreground hover:text-foreground transition">
                  ← Back to portraits
                </button>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-6 py-3 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
                >
                  Publish character <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </StepWrap>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const StepWrap = ({ children }: { children: React.ReactNode }) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    className="mt-10"
  >
    {children}
  </motion.section>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs uppercase tracking-[0.22em] text-primary/90">{children}</p>
);

const Footer = ({
  onBack,
  onNext,
  disabled,
  nextLabel = "Continue",
}: {
  onBack?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  nextLabel?: string;
}) => (
  <div className="mt-8 flex items-center justify-between">
    {onBack ? (
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition">
        ← Back
      </button>
    ) : <span />}
    {onNext && (
      <button
        onClick={onNext}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-6 py-3 text-sm font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    )}
  </div>
);

export default Create;
