import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { signInWithGoogle } from "@/lib/auth";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      navigate("/");
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm px-6 flex flex-col items-center text-center gap-8"
      >
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-primary/90">People4People</p>
          <h1 className="font-display text-4xl text-gradient leading-tight">
            A place to be<br />heard.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in to start a conversation, or to share a story that someone else might need.
          </p>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-surface border border-border px-5 py-3.5 text-sm font-medium hover:border-primary/40 hover:bg-surface-elevated transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* Google logo */}
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? "Signing in…" : "Continue with Google"}
          </button>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-xs">
          Your identity stays private. We never share your name or email with the people you speak to.
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
