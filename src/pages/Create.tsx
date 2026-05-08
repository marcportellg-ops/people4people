import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Mic, MicOff, RefreshCw, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TrustBadge } from "@/components/Trust";
import { characters } from "@/data/characters";
import { getDraftCharacterReply, generateCharacterProfile, conductRefineInterview, conductIntakeInterview, generateIntakeSummary, generateCharacterName, generateNarratorStory, translateCharacterFields } from "@/lib/claude";
import { saveCharacter, saveCharacterTranslations } from "@/lib/db";
import { generatePortraits } from "@/lib/portraits";
import { isSpeechSupported, startRecognition, fetchNarratorAudio, speakText, stopSpeaking } from "@/lib/voice";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

type Step = 0 | 1 | 2 | 3;

const Create = () => {
  const [step, setStep] = useState<Step>(0);
  const [maxStep, setMaxStep] = useState<Step>(0);

  const goToStep = (i: Step) => {
    setStep(i);
    if (i > maxStep) setMaxStep(i);
  };
  const [story, setStory] = useState("");
  const [answers, setAnswers] = useState<string[]>(Array(7).fill(""));

  // Adaptive intake interview state
  const [intakeMsgs, setIntakeMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [intakeInput, setIntakeInput] = useState("");
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeDone, setIntakeDone] = useState(false);
  const [intakeStarted, setIntakeStarted] = useState(false);
  const intakeScrollRef = useRef<HTMLDivElement>(null);
  const [selectedPortrait, setSelectedPortrait] = useState<string | null>(null);
  const [rehearsalMsgs, setRehearsalMsgs] = useState<{ role: "user" | "char"; text: string }[]>([]);
  const [rehearsalInput, setRehearsalInput] = useState("");
  const [rehearsalTyping, setRehearsalTyping] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatedPortraits, setGeneratedPortraits] = useState<string[]>([]);
  const [generatingPortraits, setGeneratingPortraits] = useState(false);
  const [portraitHints, setPortraitHints] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [generatingName, setGeneratingName] = useState(false);
  const [refinements, setRefinements] = useState({ tone: "", memory: "", reactions: "", background: "" });
  const [activeRefine, setActiveRefine] = useState<string | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewMsgs, setInterviewMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [interviewInput, setInterviewInput] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [narratorStory, setNarratorStory] = useState("");
  const [generatingNarrator, setGeneratingNarrator] = useState(false);
  const [narratorPreview, setNarratorPreview] = useState(false);
  const [storyListening, setStoryListening] = useState(false);
  const storyRecognizerRef = useRef<SpeechRecognition | null>(null);
  const storyCommittedRef = useRef(""); // confirmed final text so far in this session
  const storyStoppingRef = useRef(false); // true when user clicked stop (not browser auto-stop)
  const navigate = useNavigate();
  const { user, isModerator } = useAuth();
  const { t } = useLanguage();

  const startStoryRecognition = () => {
    const rec = startRecognition(
      (interim) => {
        const base = storyCommittedRef.current.trimEnd();
        setStory(base ? base + " " + interim : interim);
      },
      (final) => {
        const base = storyCommittedRef.current.trimEnd();
        storyCommittedRef.current = base ? base + " " + final : final;
        setStory(storyCommittedRef.current);
      },
      () => {
        // Browser ended the session — restart automatically unless user stopped it
        if (!storyStoppingRef.current) {
          storyRecognizerRef.current = null;
          startStoryRecognition();
        } else {
          setStoryListening(false);
          storyRecognizerRef.current = null;
        }
      },
      { continuous: true },
    );
    storyRecognizerRef.current = rec;
  };

  const toggleStoryListening = () => {
    if (storyListening) {
      storyStoppingRef.current = true;
      storyRecognizerRef.current?.stop();
      storyRecognizerRef.current = null;
      setStoryListening(false);
      return;
    }
    if (!isSpeechSupported()) return;
    storyCommittedRef.current = story; // anchor current text before we start
    storyStoppingRef.current = false;
    startStoryRecognition();
    setStoryListening(true);
  };

  // Auto-generate name and narrator story when entering step 3
  useEffect(() => {
    if (step !== 3 || answers[0] === "") return;
    if (!characterName && !generatingName) {
      setGeneratingName(true);
      generateCharacterName(answers)
        .then(setCharacterName)
        .catch(() => setCharacterName("Alex"))
        .finally(() => setGeneratingName(false));
    }
    if (!narratorStory && !generatingNarrator) {
      setGeneratingNarrator(true);
      const ageNum = parseInt(answers[1]?.match(/\d+/)?.[0] ?? "30") || 30;
      const longStory = [answers[2], answers[3]].filter(Boolean).join(" ") || story.slice(0, 300);
      generateNarratorStory(
        { name: characterName || "the character", age: ageNum, location: "Unknown", longStory },
        answers,
      ).then(setNarratorStory)
        .catch(() => {})
        .finally(() => setGeneratingNarrator(false));
    }
  }, [step]);

  const rerollName = () => {
    if (generatingName) return;
    setGeneratingName(true);
    setCharacterName("");
    generateCharacterName(answers)
      .then(setCharacterName)
      .catch(() => setCharacterName("Alex"))
      .finally(() => setGeneratingName(false));
  };

  // Auto-scroll intake chat
  useEffect(() => {
    intakeScrollRef.current?.scrollTo({ top: intakeScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [intakeMsgs, intakeLoading]);

  // Auto-start intake when entering step 1
  useEffect(() => {
    if (step !== 1 || intakeStarted) return;
    setIntakeStarted(true);
    setIntakeLoading(true);
    const firstMsg = { role: "user" as const, content: `Here is the story I wrote:\n\n${story}` };
    conductIntakeInterview(story, [firstMsg])
      .then((result) => {
        if (result.type === "question") {
          setIntakeMsgs([{ role: "assistant", content: result.text }]);
        }
      })
      .catch(() => {
        setIntakeMsgs([{ role: "assistant", content: "Tell me a bit about this person — who are they?" }]);
      })
      .finally(() => setIntakeLoading(false));
  }, [step, intakeStarted, story]);

  const sendIntakeAnswer = async () => {
    if (!intakeInput.trim() || intakeLoading) return;
    const userMsg = { role: "user" as const, content: intakeInput.trim() };
    const storyMsg = { role: "user" as const, content: `Here is the story I wrote:\n\n${story}` };
    const fullHistory = [storyMsg, ...intakeMsgs, userMsg];
    const updated = [...intakeMsgs, userMsg];
    setIntakeMsgs(updated);
    setIntakeInput("");
    setIntakeLoading(true);
    try {
      const result = await conductIntakeInterview(story, fullHistory);
      if (result.type === "question") {
        // After done, corrections return as questions — keep intakeDone true
        setIntakeMsgs((m) => [...m, { role: "assistant", content: result.text }]);
      } else {
        setAnswers(result.answers);
        const summary = await generateIntakeSummary(result.answers);
        setIntakeDone(true);
        setIntakeMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: summary,
          },
        ]);
      }
    } catch {
      setIntakeMsgs((m) => [...m, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setIntakeLoading(false);
    }
  };

  const handleGeneratePortraits = async () => {
    setGeneratingPortraits(true);
    setSelectedPortrait(null);
    try {
      const baseDesc = answers[0] || "person";
      const personDesc = portraitHints.trim() ? `${baseDesc}, ${portraitHints.trim()}` : baseDesc;
      const ageStr = answers[1] || "30";
      const ageNum = parseInt(ageStr.match(/\d+/)?.[0] ?? "30");
      const portraits = await generatePortraits(personDesc, ageNum);
      setGeneratedPortraits(portraits);
    } catch (err: any) {
      alert("Portrait generation failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setGeneratingPortraits(false);
    }
  };

  const startInterview = async () => {
    setInterviewOpen(true);
    setInterviewMsgs([]);
    setInterviewDone(false);
    setInterviewLoading(true);
    try {
      const result = await conductRefineInterview(story, answers, []);
      if (result.type === "question") {
        setInterviewMsgs([{ role: "assistant", content: result.text }]);
      }
    } finally {
      setInterviewLoading(false);
    }
  };

  const sendInterviewAnswer = async () => {
    if (!interviewInput.trim() || interviewLoading) return;
    const userMsg = { role: "user" as const, content: interviewInput.trim() };
    const updated = [...interviewMsgs, userMsg];
    setInterviewMsgs(updated);
    setInterviewInput("");
    setInterviewLoading(true);
    try {
      const result = await conductRefineInterview(story, answers, updated);
      if (result.type === "question") {
        setInterviewMsgs((m) => [...m, { role: "assistant", content: result.text }]);
      } else {
        setRefinements(result.refinements);
        setInterviewDone(true);
        setInterviewMsgs((m) => [...m, { role: "assistant", content: "Done — I've filled in the refinements based on your answers. You can review and adjust them above." }]);
      }
    } finally {
      setInterviewLoading(false);
    }
  };

  const refinePresets = {
    tone: [
      "Withdrawn, speaks in short sentences",
      "Warm but guarded, opens up slowly",
      "Anxious, overthinks before answering",
      "Composed on the surface, breaking inside",
      "Uses humor to hide the pain",
    ],
    memory: [
      "Keeps replaying the last conversation they had",
      "Remembers a specific argument that started it all",
      "Has a happy memory that makes the loss worse",
      "Blocked most of it out, only remembers fragments",
      "Remembers every unanswered message",
    ],
    reactions: [
      "Gets defensive when told they were wrong",
      "Shuts down when pushed too hard",
      "Tears up when someone really listens",
      "Changes subject when it gets too painful",
      "Needs to feel understood before opening up",
    ],
    background: [
      "Grew up in a family where emotions weren't discussed",
      "Has lost people before and recognizes this feeling",
      "Never had many close friends — this one was rare",
      "Work has always come first, now questioning that",
      "Was let down by people in the past, finds trust hard",
    ],
  };

  // TEMPORARY — delete this function when no longer needed for testing
  const fillTestData = async () => {
    const testAnswers = [
      "A man in his late 30s, short dark curly hair, light beard, strong jaw, works in finance, values loyalty above everything",
      "38",
      "He missed his best friend's wedding due to a last-minute work crisis and now the friendship is completely silent",
      "That 10 years of friendship can just disappear without even being given a chance to explain",
      "That he'll never get the friendship back and that deep down he made the wrong choice that day",
      "He overworks. Keeps replaying the situation in his head. Doesn't talk about it with anyone",
      "Someone to help him figure out if he should keep trying or accept that it's over",
    ];
    setStory("My best friend of 10 years suddenly stopped talking to me after I missed his wedding because of a work emergency. I've tried to reach out multiple times but he never responds. I feel guilty but also angry that he won't even let me explain.");
    setAnswers(testAnswers);
    setIntakeStarted(true);
    setGeneratedPortraits(characters.slice(0, 4).map((c) => c.portrait));
    setSelectedPortrait(characters[0].portrait);
    goToStep(1);
    setIntakeLoading(true);
    try {
      const summary = await generateIntakeSummary(testAnswers);
      setIntakeMsgs([{ role: "assistant", content: summary }]);
      setIntakeDone(true);
    } catch {
      setIntakeMsgs([{ role: "assistant", content: "I have a clear picture of this person now.\n\nChange anything that doesn't feel true, or that I didn't understand quite right." }]);
      setIntakeDone(true);
    } finally {
      setIntakeLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedPortrait) return;
    setPublishing(true);
    try {
      const profile = await generateCharacterProfile(story, answers);
      const finalName = characterName || profile.name;
      const replaceName = (text: string) =>
        profile.name ? text.replaceAll(profile.name, finalName) : text;
      const finalSummary = replaceName(profile.summary);
      const finalLongStory = replaceName(profile.longStory);
      const finalIntro = replaceName(profile.intro);
      const charId = await saveCharacter(
        {
          ...profile,
          name: finalName,
          summary: finalSummary,
          longStory: finalLongStory,
          intro: finalIntro,
          portrait: selectedPortrait,
          ...(narratorStory ? { narratorStory } : {}),
        },
        user!.uid,
        user!.email ?? undefined,
      );
      // Translate all fields to ES/IT/FR in background — does not block navigation
      const fields = { narratorStory: narratorStory || "", summary: finalSummary, longStory: finalLongStory, intro: finalIntro };
      Promise.all([
        translateCharacterFields(fields, "es"),
        translateCharacterFields(fields, "it"),
        translateCharacterFields(fields, "fr"),
      ]).then(([es, it, fr]) =>
        saveCharacterTranslations(charId, { es, it, fr }),
      ).catch(() => {});
      navigate("/gallery");
    } catch {
      alert("Something went wrong while publishing. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  if (narratorPreview && narratorStory && selectedPortrait) {
    return (
      <NarratorPreviewOverlay
        narratorStory={narratorStory}
        characterName={characterName}
        portrait={selectedPortrait}
        onPublish={handlePublish}
        onBack={() => setNarratorPreview(false)}
        publishing={publishing}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <TopNav />
      <div className="container pt-32 max-w-4xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-4 w-4" /> {t("create.back")}
          </Link>
          {isModerator && (
            <button
              onClick={fillTestData}
              className="text-xs border border-dashed border-yellow-500/50 text-yellow-500/70 rounded-full px-3 py-1 hover:border-yellow-500 hover:text-yellow-500 transition"
            >
              ⚡ Fill test data
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-3">
          {[t("create.steps.story"), t("create.steps.person"), t("create.steps.face"), t("create.steps.rehearse")].map((label, i) => (
            <div key={label} className="flex-1 flex items-center gap-3">
              <div
                onClick={() => i !== step && i <= maxStep && goToStep(i as Step)}
                className={`flex items-center gap-2 ${
                  i === step ? "text-foreground" : i <= maxStep ? "text-primary cursor-pointer hover:opacity-80 transition" : "text-muted-foreground"
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
              <Eyebrow>{t("create.step0.eyebrow")}</Eyebrow>
              <h1 className="font-display text-5xl md:text-6xl text-gradient leading-[1.05] mt-3">
                {t("create.step0.headline").split("\n")[0]}<br />{t("create.step0.headline").split("\n")[1]}
              </h1>
              <p className="mt-5 text-muted-foreground max-w-xl">
                {t("create.step0.body")}
              </p>
              <div className="mt-8 glass-strong rounded-3xl p-2">
                <textarea
                  value={story}
                  onChange={(e) => { if (!storyListening) setStory(e.target.value); }}
                  rows={9}
                  placeholder={storyListening ? "Listening… speak your story" : t("create.step0.placeholder")}
                  className={`w-full bg-transparent rounded-2xl p-5 text-base leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none resize-none transition ${storyListening ? "text-muted-foreground italic" : ""}`}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  {isSpeechSupported() && (
                    <motion.button
                      onClick={toggleStoryListening}
                      animate={storyListening ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                      className={`inline-flex items-center gap-2 text-xs transition rounded-full px-3 py-1.5 border ${
                        storyListening
                          ? "bg-red-500/15 border-red-500/50 text-red-400"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {storyListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      {storyListening ? t("create.step0.stopListening") : t("create.step0.speak")}
                    </motion.button>
                  )}
                  <span className="text-xs text-muted-foreground">{story.length} characters</span>
                </div>
              </div>
              <TrustBadge className="mt-6">{t("create.step0.trust")}</TrustBadge>
              <Footer
                onNext={() => goToStep(1)}
                disabled={story.trim().length < 12}
              />
            </StepWrap>
          )}

          {step === 1 && (
            <StepWrap key="1">
              <Eyebrow>{t("create.step1.eyebrow")}</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl text-gradient leading-[1.05] mt-3">
                {t("create.step1.headline")}
              </h1>
              <p className="mt-4 text-muted-foreground max-w-xl">
                {t("create.step1.body")}
              </p>

              <div className="mt-8 glass-strong rounded-3xl overflow-hidden flex flex-col" style={{ height: "460px" }}>
                <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  {t("create.step1.listening")}
                </div>

                <div ref={intakeScrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                  {intakeLoading && intakeMsgs.length === 0 && (
                    <div className="flex justify-start">
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
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {intakeMsgs.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-primary/15 border border-primary/20 rounded-br-sm"
                            : "bg-surface-elevated/80 border border-border/60 rounded-bl-sm"
                        }`}>
                          {m.content}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {intakeLoading && intakeMsgs.length > 0 && (
                    <div className="flex justify-start">
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
                    </div>
                  )}
                </div>

                <div className="border-t border-border/40 p-3 flex gap-2">
                  <input
                    value={intakeInput}
                    onChange={(e) => setIntakeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendIntakeAnswer()}
                    disabled={intakeLoading}
                    placeholder={intakeDone ? t("create.step1.correct") : t("create.step1.placeholder")}
                    className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition disabled:opacity-40"
                  />
                  <button
                    onClick={sendIntakeAnswer}
                    disabled={!intakeInput.trim() || intakeLoading}
                    className="grid h-10 w-10 place-items-center rounded-full bg-gradient-amber text-primary-foreground shadow-glow hover:scale-105 transition disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <Footer
                onBack={() => goToStep(0)}
                onNext={() => goToStep(2)}
                disabled={!intakeDone}
                nextLabel={t("create.step1.next")}
              />
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap key="2">
              <Eyebrow>{t("create.step2.eyebrow")}</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl text-gradient leading-[1.05] mt-3">
                {t("create.step2.headline").split("\n")[0]}<br />{t("create.step2.headline").split("\n")[1]}
              </h1>
              <p className="mt-4 text-muted-foreground max-w-xl">
                {t("create.step2.body")}
              </p>

              {generatedPortraits.length === 0 && !generatingPortraits && (
                <div className="mt-8 space-y-5">
                  {/* What we already know */}
                  {answers[0] && (
                    <div className="glass rounded-2xl p-4 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("create.step2.basedOn")}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{answers[0]}</p>
                    </div>
                  )}

                  {/* Optional extra details */}
                  <div className="glass-strong rounded-2xl p-5 space-y-3">
                    <div>
                      <p className="text-sm font-medium">{t("create.step2.addDetails")} <span className="text-muted-foreground font-normal">(optional)</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("create.step2.addDetailsSub")}</p>
                    </div>
                    <textarea
                      value={portraitHints}
                      onChange={(e) => setPortraitHints(e.target.value)}
                      rows={3}
                      placeholder={t("create.step2.detailsPlaceholder")}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition resize-none placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={handleGeneratePortraits}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-6 py-3 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
                    >
                      <Sparkles className="h-4 w-4" /> {t("create.step2.generate")}
                    </button>
                  </div>
                </div>
              )}

              {generatingPortraits && (
                <div className="mt-10 flex flex-col items-center gap-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        className="aspect-[3/4] rounded-2xl bg-surface-elevated/60 border border-border/40"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{t("create.step2.generating")}</p>
                </div>
              )}

              {generatedPortraits.length > 0 && !generatingPortraits && (
                <>
                  <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {generatedPortraits.map((p, i) => {
                      const active = selectedPortrait === p;
                      return (
                        <motion.button
                          key={i}
                          onClick={() => setSelectedPortrait(p)}
                          whileHover={{ y: -4 }}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
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
                          <div className="absolute bottom-2 left-2">
                            <span className="text-xs text-muted-foreground">Option {i + 1}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        value={portraitHints}
                        onChange={(e) => setPortraitHints(e.target.value)}
                        placeholder={t("create.step2.adjust")}
                        className="flex-1 bg-surface border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition placeholder:text-muted-foreground/50"
                      />
                      <button
                        onClick={handleGeneratePortraits}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition shrink-0"
                      >
                        <RefreshCw className="h-4 w-4" /> {t("create.step2.regenerate")}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <span className="text-xs text-muted-foreground">{selectedPortrait ? t("create.step2.selected") : t("create.step2.pickOne")}</span>
                    </div>
                  </div>
                </>
              )}

              <Footer
                onBack={() => goToStep(1)}
                onNext={() => goToStep(3)}
                disabled={!selectedPortrait}
                nextLabel={t("create.step2.next")}
              />
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap key="3">
              <Eyebrow>{t("create.step3.eyebrow")}</Eyebrow>
              <h1 className="font-display text-4xl md:text-5xl text-gradient leading-[1.05] mt-3">
                {t("create.step3.headline")}
              </h1>
              <p className="mt-4 text-muted-foreground max-w-xl">
                {t("create.step3.body")}
              </p>

              <div className="mt-8 grid lg:grid-cols-[260px_1fr] gap-5">
                <div className="space-y-4">
                  {selectedPortrait && (
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-portrait">
                      <img src={selectedPortrait} alt="Selected character" className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-portrait" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            {generatingName ? (
                              <motion.p
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                                className="font-display text-lg text-muted-foreground"
                              >
                                {t("create.step3.naming")}
                              </motion.p>
                            ) : (
                              <p className="font-display text-lg">{characterName || "—"}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">{t("create.step3.fictionalName")}</p>
                          </div>
                          <button
                            onClick={rerollName}
                            disabled={generatingName}
                            title="Generate a different name"
                            className="mb-0.5 grid h-7 w-7 place-items-center rounded-full bg-background/40 backdrop-blur border border-border/40 hover:border-primary/50 transition disabled:opacity-40"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="glass rounded-2xl p-4 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Refine</p>
                    {(["tone", "memory", "reactions", "background"] as const).map((key) => (
                      <div key={key}>
                        <button
                          onClick={() => setActiveRefine(activeRefine === key ? null : key)}
                          className={`w-full text-left text-sm rounded-lg border px-3 py-2 transition capitalize ${
                            refinements[key] ? "border-primary/50 text-primary" : "border-border/60 hover:border-primary/40"
                          }`}
                        >
                          {key} {refinements[key] ? "✦" : "→"}
                        </button>
                        {activeRefine === key && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {refinePresets[key].map((preset) => (
                                <button
                                  key={preset}
                                  onClick={() => setRefinements((r) => ({ ...r, [key]: preset }))}
                                  className={`text-[11px] rounded-full px-2.5 py-1 border transition ${
                                    refinements[key] === preset
                                      ? "bg-primary/20 border-primary/50 text-primary"
                                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                  }`}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={refinements[key]}
                              onChange={(e) => setRefinements((r) => ({ ...r, [key]: e.target.value }))}
                              placeholder="Or write your own…"
                              rows={2}
                              className="w-full bg-surface border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-primary/50 resize-none transition placeholder:text-muted-foreground/40"
                            />
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* AI Interview */}
                  {!interviewOpen ? (
                    <button
                      onClick={startInterview}
                      className="w-full text-xs rounded-xl border border-dashed border-primary/30 text-primary/70 px-3 py-2.5 hover:border-primary/60 hover:text-primary transition"
                    >
                      {t("create.step3.aiInterview")}
                    </button>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-3 space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">{t("create.step3.aiInterviewLabel")}</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {interviewMsgs.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              m.role === "user"
                                ? "bg-primary/15 border border-primary/20"
                                : "bg-surface-elevated/80 border border-border/60"
                            }`}>
                              {m.content}
                            </div>
                          </div>
                        ))}
                        {interviewLoading && (
                          <div className="flex justify-start">
                            <div className="rounded-xl bg-surface-elevated/80 border border-border/60 px-3 py-2 inline-flex gap-1">
                              {[0,1,2].map((d) => (
                                <motion.span key={d} animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.15 }} className="h-1 w-1 rounded-full bg-foreground/70" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {!interviewDone && (
                        <div className="flex gap-2 pt-1">
                          <input
                            value={interviewInput}
                            onChange={(e) => setInterviewInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendInterviewAnswer()}
                            placeholder="Your answer…"
                            className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary/50 transition"
                          />
                          <button onClick={sendInterviewAnswer} className="rounded-lg bg-primary/20 border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/30 transition">
                            →
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="glass-strong rounded-3xl flex flex-col h-[520px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("create.step3.privateLabel")}</span>
                    <TrustBadge>{t("create.step3.draftMode")}</TrustBadge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {rehearsalMsgs.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center mt-20">
                        {t("create.step3.sayHello")}
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
                    {rehearsalTyping && (
                      <div className="flex justify-start">
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
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border/40 p-3 flex gap-2">
                    <input
                      value={rehearsalInput}
                      onChange={(e) => setRehearsalInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && rehearsalInput.trim() && !rehearsalTyping) {
                          const text = rehearsalInput.trim();
                          const updatedMsgs = [...rehearsalMsgs, { role: "user" as const, text }];
                          setRehearsalMsgs(updatedMsgs);
                          setRehearsalInput("");
                          setRehearsalTyping(true);
                          try {
                            const history = updatedMsgs.map((m) => ({
                              role: m.role === "user" ? ("user" as const) : ("assistant" as const),
                              content: m.text,
                            }));
                            const reply = await getDraftCharacterReply(story, answers, history, refinements);
                            setRehearsalMsgs((m) => [...m, { role: "char", text: reply }]);
                          } catch {
                            setRehearsalMsgs((m) => [...m, { role: "char", text: "Sorry, I couldn't respond right now." }]);
                          } finally {
                            setRehearsalTyping(false);
                          }
                        }
                      }}
                      placeholder={t("create.step3.testLine")}
                      className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={() => goToStep(2)} className="text-sm text-muted-foreground hover:text-foreground transition">
                  {t("create.step3.backToPortraits")}
                </button>
                <div className="flex flex-col items-end gap-1.5">
                  {generatingNarrator && (
                    <motion.p
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="text-xs text-muted-foreground"
                    >
                      {t("create.step3.writingStory")}
                    </motion.p>
                  )}
                  <button
                    disabled={generatingNarrator || !narratorStory}
                    onClick={() => setNarratorPreview(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-6 py-3 text-sm font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {t("create.step3.hearStory")} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </StepWrap>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const NarratorPreviewOverlay = ({
  narratorStory,
  characterName,
  portrait,
  onPublish,
  onBack,
  publishing,
}: {
  narratorStory: string;
  characterName: string;
  portrait: string;
  onPublish: () => void;
  onBack: () => void;
  publishing: boolean;
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const [revealedCount, setRevealedCount] = useState(0);
  const [narrationDone, setNarrationDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const paragraphTimestamps = useRef<number[]>([]);
  const paragraphs = narratorStory.split(/\n\n+/).filter(Boolean);

  useEffect(() => {
    let blobUrl: string | null = null;
    fetchNarratorAudio(narratorStory).then((url) => {
      blobUrl = url;
      setAudioUrl(url);
      setAudioLoading(false);
    }).catch(() => setAudioLoading(false));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, []);

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
    const t = audioRef.current.currentTime;
    setRevealedCount(paragraphTimestamps.current.filter((ts) => t >= ts).length);
  };

  // Fallback: browser TTS if no ElevenLabs key
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
    speakText(narratorStory, { narrator: true, onEnd: () => setNarrationDone(true) });
    return () => { timersRef.current.forEach(clearTimeout); stopSpeaking(); };
  }, [audioLoading, audioUrl]);

  const stopAll = () => {
    timersRef.current.forEach(clearTimeout);
    if (audioRef.current) { audioRef.current.pause(); }
    else { stopSpeaking(); }
  };

  const skipToEnd = () => {
    stopAll();
    setRevealedCount(paragraphs.length);
    setNarrationDone(true);
  };

  const { t } = useLanguage();

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
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
        <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-3xl scale-110" />
        <div className="absolute inset-0 bg-background/90" />
      </div>

      {/* Skip button */}
      {!narrationDone && (
        <button
          onClick={skipToEnd}
          className="fixed top-6 right-6 z-20 inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition"
        >
          {t("create.narrator.skip")} <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Loading */}
      {audioLoading && (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="text-sm text-muted-foreground tracking-wide"
          >
            {t("create.narrator.preparing")}
          </motion.p>
        </div>
      )}

      {/* Content */}
      {!audioLoading && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 min-h-screen overflow-y-auto">
          <div className="max-w-2xl w-full space-y-10">

            {/* Character header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
              className="flex items-center gap-4"
            >
              <img src={portrait} alt={characterName} className="h-14 w-14 rounded-full object-cover border border-border/40" />
              <div>
                <p className="font-display text-xl">{characterName}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{t("create.narrator.theirStory")}</p>
              </div>
            </motion.div>

            {/* Narrator paragraphs */}
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

            {/* Action buttons — appear after narration ends */}
            <AnimatePresence>
              {narrationDone && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="flex flex-col sm:flex-row gap-3 pt-4"
                >
                  <button
                    onClick={() => { stopAll(); onPublish(); }}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-7 py-3.5 text-sm font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {publishing ? t("create.narrator.publishing") : t("create.narrator.publish")}
                    {!publishing && <ArrowRight className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => { stopAll(); onBack(); }}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-3.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition disabled:opacity-40"
                  >
                    {t("create.narrator.fix")}
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
  nextLabel,
}: {
  onBack?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  nextLabel?: string;
}) => {
  const { t } = useLanguage();
  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition">
          {t("common.back")}
        </button>
      ) : <span />}
      {onNext && (
        <button
          onClick={onNext}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-6 py-3 text-sm font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {nextLabel ?? t("common.continue")} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Create;
