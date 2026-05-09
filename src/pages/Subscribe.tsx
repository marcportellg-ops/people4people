import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles, Users } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/context/AuthContext";
import { usePlan } from "@/context/PlanContext";
import { setUserPlan } from "@/lib/db";
import type { Plan } from "@/lib/plans";

const HELPER_LINK  = import.meta.env.VITE_STRIPE_HELPER_LINK  as string | undefined;
const CREATOR_LINK = import.meta.env.VITE_STRIPE_CREATOR_LINK as string | undefined;

function stripeUrl(link: string | undefined, uid: string, email: string) {
  if (!link) return "#";
  const url = new URL(link);
  url.searchParams.set("client_reference_id", uid);
  url.searchParams.set("prefilled_email", email);
  return url.toString();
}

const HELPER_FEATURES = [
  "Unlimited conversations",
  "60-minute sessions",
  "Voice & text",
  "1 character created",
];

const CREATOR_FEATURES = [
  "Everything in Helper",
  "Unlimited characters",
  "Priority moderation",
  "Deep emotional insights",
];

const Subscribe = () => {
  const { user } = useAuth();
  const { plan, refetch } = usePlan();
  const [params] = useSearchParams();
  const [successPlan, setSuccessPlan] = useState<Plan | null>(null);

  // Handle Stripe success redirect: ?success=1&plan=helper|creator
  useEffect(() => {
    const success = params.get("success");
    const p = params.get("plan") as Plan | null;
    if (success === "1" && (p === "helper" || p === "creator") && user) {
      setUserPlan(user.uid, p).then(() => {
        setSuccessPlan(p);
        refetch();
      }).catch(() => {});
    }
  }, [params, user]);

  const uid   = user?.uid ?? "";
  const email = user?.email ?? "";

  return (
    <div className="min-h-screen pb-24">
      <TopNav />
      <div className="container pt-32 max-w-5xl">
        <Link to="/gallery" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back to the gallery
        </Link>

        {successPlan ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 text-center max-w-lg mx-auto space-y-4"
          >
            <div className="text-5xl">✓</div>
            <h2 className="font-display text-3xl">
              You're now on {successPlan === "helper" ? "Helper Premium" : "Creator Premium"}.
            </h2>
            <p className="text-muted-foreground">Your plan has been activated. Thank you.</p>
            <Link
              to="/gallery"
              className="inline-flex items-center gap-2 mt-4 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium"
            >
              Back to the gallery
            </Link>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 text-center max-w-2xl mx-auto"
            >
              <h1 className="font-display text-5xl md:text-6xl text-gradient leading-[1.05]">
                Choose your role.
              </h1>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                Every conversation you have reaches a real person. Upgrade to do more of it.
              </p>
            </motion.div>

            <div className="mt-14 grid md:grid-cols-3 gap-4">
              {/* Free */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-3xl border border-border bg-surface p-7 flex flex-col"
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {plan === "free" ? "Current plan" : "Free"}
                </p>
                <h3 className="mt-2 font-display text-2xl">Free</h3>
                <p className="mt-4 font-display text-4xl">€0</p>
                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground flex-1">
                  <li className="flex gap-2"><span>·</span>2 conversations total</li>
                  <li className="flex gap-2"><span>·</span>15-minute sessions</li>
                  <li className="flex gap-2"><span>·</span>1 character created</li>
                  <li className="flex gap-2"><span>·</span>Text only</li>
                </ul>
                {plan === "free" && (
                  <span className="mt-7 text-center text-xs text-muted-foreground">Your current plan</span>
                )}
              </motion.div>

              {/* Helper Premium */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative rounded-3xl border border-primary/40 bg-gradient-to-br from-surface-elevated to-surface p-7 shadow-glow overflow-hidden flex flex-col"
              >
                <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Helper
                    </p>
                    {plan === "free" && (
                      <span className="text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 uppercase tracking-wider">
                        Most popular
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-2xl">Helper Premium</h3>
                  <p className="mt-4 font-display text-4xl">
                    €4<span className="text-base text-muted-foreground font-sans">/mo</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm flex-1">
                    {HELPER_FEATURES.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan === "helper" ? (
                    <span className="mt-7 text-center text-xs text-muted-foreground">Your current plan</span>
                  ) : plan === "creator" ? (
                    <span className="mt-7 text-center text-xs text-muted-foreground">Included in Creator</span>
                  ) : (
                    <a
                      href={stripeUrl(HELPER_LINK, uid, email)}
                      className="mt-7 w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium text-center hover:scale-[1.01] transition block"
                    >
                      Start for €4/mo
                    </a>
                  )}
                </div>
              </motion.div>

              {/* Creator Premium */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-br from-surface-elevated to-surface p-7 overflow-hidden flex flex-col"
              >
                <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col flex-1">
                  <p className="text-xs uppercase tracking-wider text-amber-400 inline-flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Creator
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-gradient-amber">Creator Premium</h3>
                  <p className="mt-4 font-display text-4xl">
                    €8<span className="text-base text-muted-foreground font-sans">/mo</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm flex-1">
                    {CREATOR_FEATURES.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan === "creator" ? (
                    <span className="mt-7 text-center text-xs text-muted-foreground">Your current plan</span>
                  ) : (
                    <a
                      href={stripeUrl(CREATOR_LINK, uid, email)}
                      className="mt-7 w-full rounded-full bg-gradient-amber text-primary-foreground py-3 text-sm font-medium text-center hover:scale-[1.01] transition block"
                    >
                      Start for €8/mo
                    </a>
                  )}
                </div>
              </motion.div>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Cancel anytime · No ads · Payments secured by Stripe
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Subscribe;
