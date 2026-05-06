import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { getCharacterById, updateCharacter } from "@/lib/db";
import { conductCharacterEdit } from "@/lib/claude";
import { useAuth } from "@/context/AuthContext";
import type { Character } from "@/data/characters";

type ChatMessage = { role: "user" | "ai"; text: string };
type Proposal = {
  text: string;
  changes: Partial<{ summary: string; longStory: string; intro: string; narratorStory: string; refinements: Character["refinements"] }>;
};

const EditCharacter = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [saving, setSaving] = useState(false);
  const [narratorOpen, setNarratorOpen] = useState(false);
  const [narratorEdit, setNarratorEdit] = useState("");
  const [savingNarrator, setSavingNarrator] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    getCharacterById(id).then((c) => {
      if (!c) { setNotFound(true); return; }
      if ((c as any).creatorId && (c as any).creatorId !== user?.uid) {
        setUnauthorized(true); return;
      }
      setCharacter(c);
      setNarratorEdit(c.narratorStory ?? "");
      setMessages([{
        role: "ai",
        text: `Hi! I'm here to help you refine ${c.name}'s character. What would you like to change — the story, the tone, a memory, how they react? Just tell me in your own words.`,
      }]);
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, proposal]);

  const toHistory = (msgs: ChatMessage[]) =>
    msgs.map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.text }));

  const send = async () => {
    if (!input.trim() || !character || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setProposal(null);

    const updated: ChatMessage[] = [...messages, { role: "user", text: userMsg }];
    setMessages(updated);
    setThinking(true);

    try {
      const result = await conductCharacterEdit(character, toHistory(updated));
      if (result.type === "proposal") {
        setMessages((prev) => [...prev, { role: "ai", text: result.text }]);
        setProposal({ text: result.text, changes: result.changes });
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: result.text }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Something went wrong. Try again." }]);
    } finally {
      setThinking(false);
    }
  };

  const applyChanges = async () => {
    if (!proposal || !character || !id) return;
    setSaving(true);
    try {
      const c = proposal.changes;
      await updateCharacter(id, {
        summary: c.summary ?? character.summary,
        longStory: c.longStory ?? character.longStory,
        intro: c.intro ?? character.intro,
        refinements: c.refinements ?? character.refinements,
        narratorStory: c.narratorStory ?? character.narratorStory,
      });
      navigate("/profile");
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Couldn't save the changes. Please try again." }]);
    } finally {
      setSaving(false);
    }
  };

  const dismissProposal = () => {
    setProposal(null);
    setMessages((prev) => [...prev, { role: "ai", text: "No problem — tell me what you'd like to adjust instead." }]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (loading) return (
    <div className="min-h-screen grid place-items-center">
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
        className="text-muted-foreground text-sm">Loading…</motion.div>
    </div>
  );

  if (notFound || unauthorized) return (
    <div className="min-h-screen grid place-items-center text-center space-y-3">
      <p className="font-display text-2xl">{unauthorized ? "Not your character." : "Character not found."}</p>
      <Link to="/profile" className="text-sm text-primary hover:underline">Back to profile</Link>
    </div>
  );

  if (!character) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={character.portrait} alt="" className="absolute inset-0 h-full w-full object-cover opacity-8 blur-3xl scale-110" />
        <div className="absolute inset-0 bg-background/92" />
      </div>

      {/* Header */}
      <div className="sticky top-16 z-40 glass border-b border-border/40 mt-16">
        <div className="container max-w-2xl flex items-center gap-4 h-14">
          <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={character.portrait} alt={character.name} className="h-8 w-8 rounded-full object-cover border border-border/60" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{character.name}</p>
            <p className="text-xs text-muted-foreground">Editing with AI</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 container max-w-2xl py-6 space-y-4 pb-48">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <img src={character.portrait} alt="" className="h-7 w-7 rounded-full object-cover border border-border/60 mr-2 mt-1 shrink-0" />
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "glass border border-border/40 rounded-bl-sm text-foreground/90"
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <img src={character.portrait} alt="" className="h-7 w-7 rounded-full object-cover border border-border/60 mr-2 mt-1 shrink-0" />
            <div className="glass border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Proposal card */}
        <AnimatePresence>
          {proposal && !thinking && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="glass border border-primary/30 rounded-2xl p-5 space-y-4"
            >
              <p className="text-xs uppercase tracking-wider text-primary/80">Proposed changes</p>
              <div className="space-y-3 text-sm">
                {proposal.changes.intro && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Opening line</p>
                    <p className="text-foreground/90 italic">"{proposal.changes.intro}"</p>
                  </div>
                )}
                {proposal.changes.summary && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Summary</p>
                    <p className="text-foreground/90">{proposal.changes.summary}</p>
                  </div>
                )}
                {proposal.changes.longStory && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Full story</p>
                    <p className="text-foreground/90">{proposal.changes.longStory}</p>
                  </div>
                )}
                {proposal.changes.refinements?.tone && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">How they speak</p>
                    <p className="text-foreground/90">{proposal.changes.refinements.tone}</p>
                  </div>
                )}
                {proposal.changes.refinements?.memory && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Memory</p>
                    <p className="text-foreground/90">{proposal.changes.refinements.memory}</p>
                  </div>
                )}
                {proposal.changes.refinements?.reactions && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reactions</p>
                    <p className="text-foreground/90">{proposal.changes.refinements.reactions}</p>
                  </div>
                )}
                {proposal.changes.refinements?.background && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Background</p>
                    <p className="text-foreground/90">{proposal.changes.refinements.background}</p>
                  </div>
                )}
                {proposal.changes.narratorStory && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Narrator story</p>
                    <p className="text-foreground/90 text-xs leading-relaxed whitespace-pre-line">{proposal.changes.narratorStory}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={applyChanges}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-5 py-2 text-sm font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Apply changes"}
                </button>
                <button
                  onClick={dismissProposal}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-3.5 w-3.5" /> Not quite
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direct narrator story editor */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass border border-border/40 rounded-2xl overflow-hidden"
        >
          <button
            onClick={() => setNarratorOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <span>Edit narrator story directly</span>
            {narratorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {narratorOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                  <p className="text-xs text-muted-foreground">This text is read aloud by the narrator before helpers start a conversation. 3 paragraphs, separated by blank lines.</p>
                  <textarea
                    value={narratorEdit}
                    onChange={(e) => setNarratorEdit(e.target.value)}
                    rows={8}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary/50 transition resize-none placeholder:text-muted-foreground/40"
                    placeholder="Narrator story…"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{narratorEdit.trim().split(/\s+/).filter(Boolean).length} words</span>
                    <button
                      disabled={savingNarrator || !narratorEdit.trim() || narratorEdit === (character?.narratorStory ?? "")}
                      onClick={async () => {
                        if (!character || !id) return;
                        setSavingNarrator(true);
                        try {
                          await updateCharacter(id, {
                            summary: character.summary,
                            longStory: character.longStory,
                            intro: character.intro,
                            narratorStory: narratorEdit.trim(),
                          });
                          setCharacter((c) => c ? { ...c, narratorStory: narratorEdit.trim() } : c);
                          setNarratorOpen(false);
                        } catch {
                          setMessages((prev) => [...prev, { role: "ai", text: "Couldn't save the narrator story. Please try again." }]);
                        } finally {
                          setSavingNarrator(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-4 py-2 text-xs font-medium shadow-glow hover:scale-[1.02] transition disabled:opacity-40 disabled:hover:scale-100"
                    >
                      <Check className="h-3 w-3" /> {savingNarrator ? "Saving…" : "Save narrator story"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-0 inset-x-0 glass border-t border-border/40 z-40">
        <div className="container max-w-2xl py-4 flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Tell me what you'd like to change…"
            className="flex-1 resize-none bg-surface-elevated/60 border border-border/60 rounded-2xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition max-h-32 leading-relaxed"
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = t.scrollHeight + "px";
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking}
            className="h-11 w-11 rounded-full bg-gradient-amber text-primary-foreground grid place-items-center shadow-glow hover:scale-105 transition disabled:opacity-40 disabled:hover:scale-100 shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCharacter;
