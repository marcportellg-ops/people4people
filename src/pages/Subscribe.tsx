import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Heart, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TrustStrip } from "@/components/Trust";

const features = [
  { free: "3 helping sessions per day", premium: "Unlimited helping sessions" },
  { free: "Up to 15 minutes per session", premium: "Up to 60 minutes per session" },
  { free: "Standard moderation queue", premium: "Priority moderation" },
  { free: "Text conversations", premium: "Text + voice conversations" },
  { free: "Basic emotional insights", premium: "Deep emotional analytics" },
  { free: "Community gallery access", premium: "Early access to new characters" },
];

const Subscribe = () => (
  <div className="min-h-screen pb-24">
    <TopNav />
    <div className="container pt-32 max-w-5xl">
      <Link to="/gallery" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="h-4 w-4" /> Back to the gallery
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mt-10 text-center max-w-2xl mx-auto"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-primary">
          <Heart className="h-3 w-3" /> You've helped 3 people today
        </span>
        <h1 className="mt-6 font-display text-5xl md:text-6xl text-gradient leading-[1.05]">
          Keep helping people,<br />more often.
        </h1>
        <p className="mt-5 text-muted-foreground leading-relaxed">
          You've reached today's free limit. Thirty seconds to upgrade — and someone, somewhere, gets the
          conversation they were waiting for tonight.
        </p>
      </motion.div>

      <div className="mt-14 grid md:grid-cols-2 gap-4">
        {/* Free */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="rounded-3xl border border-border bg-surface p-7"
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
          <h3 className="mt-2 font-display text-3xl">Free</h3>
          <p className="mt-4 font-display text-5xl">$0<span className="text-base text-muted-foreground font-sans">/mo</span></p>
          <ul className="mt-6 space-y-3 text-sm">
            {features.map((f) => (
              <li key={f.free} className="flex gap-3 text-muted-foreground">
                <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full border border-border">·</span>
                {f.free}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Premium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative rounded-3xl border border-primary/40 bg-gradient-to-br from-surface-elevated to-surface p-7 shadow-glow overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Premium
              </p>
              <span className="text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 uppercase tracking-wider">Recommended</span>
            </div>
            <h3 className="mt-2 font-display text-3xl text-gradient-amber">Helper Premium</h3>
            <p className="mt-4 font-display text-5xl">
              $9.99<span className="text-base text-muted-foreground font-sans">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground">Cancel anytime · A portion funds moderation</p>
            <ul className="mt-6 space-y-3 text-sm">
              {features.map((f) => (
                <li key={f.premium} className="flex gap-3">
                  <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  {f.premium}
                </li>
              ))}
            </ul>
            <button className="mt-7 w-full rounded-full bg-gradient-amber text-primary-foreground py-3 text-sm font-medium shadow-glow hover:scale-[1.01] transition">
              Continue helping for $9.99/mo
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              No ads. No selling data. No replacing professional care.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-12">
        <TrustStrip />
      </div>
    </div>
  </div>
);

export default Subscribe;
