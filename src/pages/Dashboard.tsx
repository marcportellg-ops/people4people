import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Play, FileText, ShieldCheck, Star, TrendingUp, MessageCircle } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TrustStrip, TrustBadge } from "@/components/Trust";
import { characters } from "@/data/characters";

const myCharacters = [
  { ...characters[0], status: "Live", sessions: 24, rating: 4.8 },
  { ...characters[3], status: "Live", sessions: 11, rating: 4.6 },
  { ...characters[7], status: "Draft", sessions: 0, rating: 0 },
];

const conversations = [
  {
    id: 1,
    character: "Joan",
    when: "2 hours ago",
    summary:
      "Helper offered grounding language and acknowledged the loss of identity that comes after a long marriage ending.",
    recommendations: [
      "Consider a small daily ritual that's only yours",
      "Reach out to one person you trusted before the marriage",
      "Try a grief-informed therapist, not just a relationship one",
    ],
    highlights: "Helper named the silence as grief, not failure. That reframing landed deeply.",
    rating: 5,
    moderated: true,
  },
  {
    id: 2,
    character: "Joan",
    when: "Yesterday",
    summary: "Warm, listening session. Helper resisted the urge to fix, simply mirrored back what they heard.",
    recommendations: ["Permission to not have a five-year plan yet", "Journal: 'who was I at 25?'"],
    highlights: "The line 'you don't owe anyone a recovery timeline' was a turning point.",
    rating: 5,
    moderated: true,
  },
  {
    id: 3,
    character: "Amina",
    when: "3 days ago",
    summary: "Practical empathy. Helper shared shame-free framing for asking partner for help with debt.",
    recommendations: ["Open the bank app together", "Script: 'I need a teammate, not a judge'"],
    highlights: "Helper distinguished debt from worth. Strong, gentle.",
    rating: 4,
    moderated: true,
  },
];

const Dashboard = () => (
  <div className="min-h-screen pb-24">
    <TopNav />
    <div className="container pt-32 space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary/90">Your dashboard</p>
          <h1 className="mt-3 font-display text-5xl text-gradient">A quiet inbox of care.</h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            People you created, the helpers who showed up, and what they offered — all reviewed and anonymized.
          </p>
        </div>
        <Link
          to="/create"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm hover:border-primary/40 transition"
        >
          + Create another
        </Link>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={MessageCircle} label="Conversations" value="35" />
        <Stat icon={ShieldCheck} label="Moderated" value="100%" />
        <Stat icon={Star} label="Avg. usefulness" value="4.7" />
        <Stat icon={TrendingUp} label="This week" value="+8" />
      </div>

      {/* My characters */}
      <section>
        <h2 className="font-display text-2xl mb-5">Your characters</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {myCharacters.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.6 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex gap-4">
                <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0">
                  <img src={c.portrait} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl">{c.name}</h3>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      c.status === "Live" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.summary}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{c.sessions} sessions</span>
                    {c.rating > 0 && <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-primary fill-primary" />{c.rating}</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Conversations */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display text-2xl">Conversations delivered to you</h2>
          <TrustBadge>Anonymized · Moderated</TrustBadge>
        </div>
        <div className="space-y-4">
          {conversations.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.6 }}
              className="glass rounded-3xl p-6 md:p-7"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">For {c.character} · {c.when}</p>
                  <h3 className="mt-1 font-display text-xl leading-tight max-w-2xl">{c.summary}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary">
                    <ShieldCheck className="h-3 w-3" /> Moderated
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {Array.from({ length: c.rating }).map((_, k) => (
                      <Star key={k} className="h-3 w-3 fill-primary text-primary" />
                    ))}
                  </span>
                </div>
              </header>

              <div className="mt-5 grid md:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top recommendations</p>
                  <ul className="space-y-1.5 text-sm">
                    {c.recommendations.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className="text-primary mt-1">·</span>
                        <span className="text-foreground/90">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Emotional highlight</p>
                  <p className="text-sm text-foreground/90 italic leading-relaxed">"{c.highlights}"</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-full bg-secondary border border-border/60 px-4 py-2 text-sm hover:border-primary/40 transition">
                  <Play className="h-3.5 w-3.5" /> Anonymized audio · 6:42
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-primary/40 transition">
                  <FileText className="h-3.5 w-3.5" /> Full transcript
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <TrustStrip />
    </div>
  </div>
);

const Stat = ({ icon: Icon, label, value }: { icon: typeof Play; label: string; value: string }) => (
  <div className="glass rounded-2xl p-5">
    <Icon className="h-4 w-4 text-primary" />
    <p className="mt-3 font-display text-3xl">{value}</p>
    <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
  </div>
);

export default Dashboard;
