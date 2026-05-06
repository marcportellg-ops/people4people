import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Plus, Settings, Clock, Pencil, LogOut, ChevronDown, Mail } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { CharacterCard } from "@/components/CharacterCard";
import { useAuth } from "@/context/AuthContext";
import { signOutUser } from "@/lib/auth";
import { getMyCharacters, getDeliveredConversations, markDeliveriesSeen } from "@/lib/db";
import { sendDeliveryEmail } from "@/lib/email";
import type { Character } from "@/data/characters";
import type { ConversationDoc } from "@/lib/db";

const Profile = () => {
  const { user, isModerator } = useAuth();
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [deliveries, setDeliveries] = useState<ConversationDoc[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyCharacters(user.uid).then((chars) => {
      setMyCharacters(chars);
      const ids = chars.map((c) => c.id);
      return getDeliveredConversations(ids).then((convs) => {
        setDeliveries(convs);
        const unseen = convs.filter((c) => !c.seenByCreator).map((c) => c.id);
        if (unseen.length > 0) markDeliveriesSeen(unseen).catch(() => {});
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

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
            <img
              src={user.photoURL}
              alt={user.displayName ?? ""}
              className="h-20 w-20 rounded-full border-2 border-border/60 shadow-elevated"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/20 border-2 border-primary/30 grid place-items-center text-2xl font-display text-primary">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-display text-3xl leading-tight">{user.displayName ?? "Anonymous"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={signOutUser}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </motion.div>

        {/* My characters */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary/90">Your characters</p>
              <h2 className="mt-1 font-display text-2xl">Stories you've shared</h2>
            </div>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-amber text-primary-foreground px-4 py-2 text-sm font-medium shadow-glow hover:scale-[1.02] transition"
            >
              <Plus className="h-3.5 w-3.5" /> New character
            </Link>
          </div>

          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="aspect-[3/4] rounded-2xl bg-surface-elevated/60 border border-border/40"
                />
              ))}
            </div>
          )}

          {!loading && myCharacters.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center space-y-4">
              <p className="font-display text-xl text-foreground/60">You haven't shared a story yet.</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                When you create a character, it will appear here. You'll be able to see how helpers responded to them.
              </p>
              <Link
                to="/create"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-primary/40 transition"
              >
                Share your first story <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {!loading && myCharacters.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {myCharacters.map((c, i) => (
                <div key={c.id} className="relative group/card">
                  <CharacterCard character={c} index={i} />
                  <Link
                    to={`/edit/${c.id}`}
                    className="absolute top-3 right-3 z-30 h-8 w-8 grid place-items-center rounded-full bg-background/70 backdrop-blur border border-border/60 text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:text-foreground hover:border-primary/50 transition-all"
                    title="Edit character"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Responses from helpers */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14"
        >
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary/90">Responses</p>
              <h2 className="mt-1 font-display text-2xl">What helpers offered</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Moderated and anonymized — only the best sessions reach you here.
              </p>
            </div>
            {isModerator && <button
              onClick={() => sendDeliveryEmail({
                toEmail: user.email!,
                characterName: "Alejandro",
                summary: "The helper listened with real patience, reflecting back Alejandro's sense of displacement without rushing to fix it.",
                highlight: "You came with people, with energy — and now it's just you and the quiet. That's a real loss, even if the opportunity is still there.",
                recommendations: ["Stay with the silence instead of escaping it", "Write one thing each evening that felt real", "Let this season change you slowly"],
              }).then(() => alert("Test email sent!")).catch((e) => { console.error("[email error]", e); alert("Error: " + JSON.stringify(e)); })}
              className="text-xs text-muted-foreground border border-border/40 rounded-full px-3 py-1.5 hover:border-primary/40 transition shrink-0"
            >
              Send test email
            </button>}
          </div>

          {deliveries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center space-y-2">
              <p className="font-display text-xl text-foreground/60">No responses yet.</p>
              <p className="text-sm text-muted-foreground">
                When a helper has a strong session with one of your characters, it will appear here.
              </p>
            </div>
          )}

          {deliveries.length > 0 && (
            <div className="space-y-3">
              {deliveries.map((conv) => {
                const char = myCharacters.find((c) => c.id === conv.characterId);
                const isExpanded = expandedId === conv.id;
                const isNew = conv.seenByCreator === false;
                return (
                  <div
                    key={conv.id}
                    className={`glass rounded-2xl border-l-2 overflow-hidden transition-all ${isNew ? "border-l-primary" : "border-l-border/40"}`}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition"
                    >
                      {char?.portrait && (
                        <img src={char.portrait} alt={char.name} className="h-9 w-9 rounded-full object-cover border border-border/60 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{char?.name ?? "Unknown character"}</p>
                        <p className="text-xs text-muted-foreground">
                          A helper had a session — {conv.messages.filter((m) => m.role === "user").length} messages
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isNew && (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                            New
                          </span>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && conv.summary && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="px-4 pb-5 pt-1 space-y-3 border-t border-border/30">
                            <p className="text-sm text-muted-foreground leading-relaxed">{conv.summary.summary}</p>

                            {conv.summary.highlight && (
                              <blockquote className="border-l-2 border-primary/30 pl-3 text-sm italic text-foreground/80">
                                "{conv.summary.highlight}"
                              </blockquote>
                            )}

                            {conv.summary.recommendations.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {conv.summary.recommendations.map((r, i) => (
                                  <span key={i} className="rounded-full bg-surface border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => sendDeliveryEmail({
                                toEmail: user.email!,
                                characterName: char?.name ?? "Unknown",
                                summary: conv.summary!.summary,
                                highlight: conv.summary!.highlight,
                                recommendations: conv.summary!.recommendations,
                              }).then(() => alert("Email sent!")).catch((e) => { console.error("[email error]", e); alert("Error: " + JSON.stringify(e)); })}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-full px-3 py-1.5 transition mt-1"
                            >
                              <Mail className="h-3 w-3" /> Send email
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Coming soon sections */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 grid md:grid-cols-2 gap-4"
        >
          <div className="glass rounded-2xl p-6 space-y-2 opacity-50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Settings className="h-4 w-4" />
              <p className="text-xs uppercase tracking-wider">Coming soon</p>
            </div>
            <h3 className="font-display text-lg">Settings & privacy</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Control your data, notification preferences, and account settings.
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Profile;
