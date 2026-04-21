import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/gallery", label: "Gallery" },
  { to: "/create", label: "Create" },
  { to: "/dashboard", label: "Dashboard" },
];

export const TopNav = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onLanding = location.pathname === "/";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all",
        onLanding ? "bg-transparent" : "glass border-b border-border/40",
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="group flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-amber shadow-glow">
            <span className="absolute inset-0 rounded-full bg-gradient-amber blur-md opacity-60 group-hover:opacity-90 transition-opacity" />
            <span className="relative h-2 w-2 rounded-full bg-background" />
          </span>
          <span className="font-display text-lg tracking-tight">
            People<span className="text-primary">4</span>People
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "px-4 py-2 text-sm rounded-full transition-colors",
                  isActive
                    ? "text-foreground bg-secondary/60"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/subscribe"
            className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-foreground/90 hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Premium
          </Link>
          <button className="h-9 w-9 rounded-full bg-secondary border border-border/60 text-sm text-foreground/80 hover:text-foreground transition">
            AS
          </button>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden h-9 w-9 grid place-items-center rounded-full border border-border/60"
          aria-label="Menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden glass-strong border-t border-border/40"
        >
          <div className="container py-4 flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "px-4 py-3 rounded-lg text-sm",
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link
              to="/subscribe"
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-lg text-sm text-primary"
            >
              ✦ Premium
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
};
