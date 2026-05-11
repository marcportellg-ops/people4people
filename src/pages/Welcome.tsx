import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Edit3, Sparkles, Heart } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/context/UserProfileContext";
import { markOnboarded } from "@/lib/db";
import { LANGUAGE_LABELS, type Language } from "@/lib/translations";
import { cn } from "@/lib/utils";

type StepDef = { icon: React.ReactNode; title: string; body: string };

const CONTENT: Record<Language, {
  eyebrow: string;
  headline: string;
  sub: string;
  steps: StepDef[];
  cta1: string;
  cta2: string;
  ctaSub: string;
}> = {
  es: {
    eyebrow: "People4People",
    headline: "Hay personas reales\ndetrás de cada historia.",
    sub: "Antes de entrar, entiende cómo funciona.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Alguien comparte algo real",
        body: "Una persona escribe lo que vive — lo que siente, lo que no puede decirle a nadie cerca.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "Se convierte en un personaje",
        body: "Esa historia se transforma en un personaje con nombre y voz. La persona real queda protegida, en el anonimato.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Tú hablas. Tu ayuda llega.",
        body: "Llegas y hablas con ese personaje. Lo que ofreces — tu presencia, tu escucha — llega de forma real y anónima a quien lo necesita.",
      },
    ],
    cta1: "Quiero ayudar a alguien",
    cta2: "Quiero compartir algo mío",
    ctaSub: "Prueba antes. Decide después.",
  },
  en: {
    eyebrow: "People4People",
    headline: "There are real people\nbehind every story.",
    sub: "Before you begin, understand how this works.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Someone shares something real",
        body: "A person writes what they're going through — what they feel, what they can't say to anyone close.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "It becomes a character",
        body: "That story becomes a character with a name and a voice. The real person stays protected, anonymous.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "You talk. Your help arrives.",
        body: "You come and talk to that character. What you offer — your presence, your listening — arrives real and anonymous to whoever needs it.",
      },
    ],
    cta1: "I want to help someone",
    cta2: "I want to share something of mine",
    ctaSub: "Try first. Decide after.",
  },
  fr: {
    eyebrow: "People4People",
    headline: "Il y a des personnes réelles\nderrière chaque histoire.",
    sub: "Avant de commencer, comprends comment ça fonctionne.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Quelqu'un partage quelque chose de réel",
        body: "Une personne écrit ce qu'elle vit — ce qu'elle ressent, ce qu'elle ne peut dire à personne de proche.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "Cela devient un personnage",
        body: "Cette histoire devient un personnage avec un nom et une voix. La vraie personne reste protégée, anonyme.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Tu parles. Ton aide arrive.",
        body: "Tu arrives et tu parles avec ce personnage. Ce que tu offres — ta présence, ton écoute — arrive réellement et anonymement à qui en a besoin.",
      },
    ],
    cta1: "Je veux aider quelqu'un",
    cta2: "Je veux partager quelque chose",
    ctaSub: "Essaie d'abord. Décide après.",
  },
  it: {
    eyebrow: "People4People",
    headline: "Ci sono persone reali\ndietro ogni storia.",
    sub: "Prima di iniziare, capisci come funziona.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Qualcuno condivide qualcosa di reale",
        body: "Una persona scrive quello che sta vivendo — quello che sente, quello che non riesce a dire a nessuno vicino.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "Diventa un personaggio",
        body: "Quella storia diventa un personaggio con un nome e una voce. La persona reale rimane protetta, anonima.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Parli. Il tuo aiuto arriva.",
        body: "Arrivi e parli con quel personaggio. Quello che offri — la tua presenza, il tuo ascolto — arriva reale e anonimo a chi ne ha bisogno.",
      },
    ],
    cta1: "Voglio aiutare qualcuno",
    cta2: "Voglio condividere qualcosa",
    ctaSub: "Prova prima. Decidi dopo.",
  },
  de: {
    eyebrow: "People4People",
    headline: "Hinter jeder Geschichte\nstecken echte Menschen.",
    sub: "Bevor du beginnst, verstehe wie das hier funktioniert.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Jemand teilt etwas Echtes",
        body: "Eine Person schreibt, was sie durchmacht — was sie fühlt, was sie niemandem in ihrer Nähe sagen kann.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "Es wird zu einem Charakter",
        body: "Diese Geschichte wird zu einem Charakter mit einem Namen und einer Stimme. Die echte Person bleibt geschützt und anonym.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Du redest. Deine Hilfe kommt an.",
        body: "Du kommst und sprichst mit diesem Charakter. Was du anbietest — deine Anwesenheit, dein Zuhören — kommt echt und anonym bei demjenigen an, der es braucht.",
      },
    ],
    cta1: "Ich möchte jemandem helfen",
    cta2: "Ich möchte etwas von mir teilen",
    ctaSub: "Erst ausprobieren. Dann entscheiden.",
  },
  pt: {
    eyebrow: "People4People",
    headline: "Há pessoas reais\ndetrás de cada história.",
    sub: "Antes de começar, percebe como isto funciona.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Alguém partilha algo real",
        body: "Uma pessoa escreve o que está a viver — o que sente, o que não consegue dizer a ninguém próximo.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "Torna-se uma personagem",
        body: "Essa história transforma-se numa personagem com nome e voz. A pessoa real fica protegida, no anonimato.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Tu falas. A tua ajuda chega.",
        body: "Chegas e falas com essa personagem. O que ofereces — a tua presença, a tua escuta — chega de forma real e anónima a quem precisa.",
      },
    ],
    cta1: "Quero ajudar alguém",
    cta2: "Quero partilhar algo meu",
    ctaSub: "Experimenta primeiro. Decide depois.",
  },
  ca: {
    eyebrow: "People4People",
    headline: "Hi ha persones reals\ndarrere de cada història.",
    sub: "Abans d'entrar, entén com funciona.",
    steps: [
      {
        icon: <Edit3 className="h-6 w-6" />,
        title: "Algú comparteix alguna cosa real",
        body: "Una persona escriu el que viu — el que sent, el que no pot dir-li a ningú proper.",
      },
      {
        icon: <Sparkles className="h-6 w-6" />,
        title: "Es converteix en un personatge",
        body: "Aquella història es transforma en un personatge amb nom i veu. La persona real queda protegida, en l'anonimat.",
      },
      {
        icon: <Heart className="h-6 w-6" />,
        title: "Tu parles. La teva ajuda arriba.",
        body: "Arribes i parles amb aquell personatge. El que ofereixes — la teva presència, la teva escolta — arriba de forma real i anònima a qui ho necessita.",
      },
    ],
    cta1: "Vull ajudar algú",
    cta2: "Vull compartir alguna cosa meva",
    ctaSub: "Prova primer. Decideix després.",
  },
};

const LANGS: Language[] = ["en", "es", "it", "fr", "de", "pt", "ca"];

const Welcome = () => {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const { setOnboardedTrue } = useUserProfile();
  const navigate = useNavigate();
  const [ctaVisible, setCtaVisible] = useState(false);

  const c = CONTENT[lang] ?? CONTENT.en;

  const goCreate = async () => {
    if (user) await markOnboarded(user.uid).catch(() => {});
    setOnboardedTrue();
    navigate("/create");
  };

  const goDemo = async () => {
    if (user) await markOnboarded(user.uid).catch(() => {});
    setOnboardedTrue();
    navigate("/demo");
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-20 px-6">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Language selector */}
      <div className="absolute top-5 right-6 flex gap-1 flex-wrap justify-end max-w-[220px]">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-mono transition",
              lang === l
                ? "text-primary bg-primary/10"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            {LANGUAGE_LABELS[l]}
          </button>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-primary/90">{c.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl text-gradient leading-tight">
            {c.headline.split("\n").map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">{c.sub}</p>
        </motion.div>

        {/* Steps */}
        <div className="mt-14 space-y-5">
          {c.steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 + i * 0.25 }}
              onAnimationComplete={() => { if (i === c.steps.length - 1) setCtaVisible(true); }}
              className="glass rounded-2xl p-5 flex items-start gap-5"
            >
              <div className="shrink-0 h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center text-primary">
                {step.icon}
              </div>
              <div>
                <p className="font-display text-lg leading-tight">{step.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTAs */}
        <AnimatePresence>
          {ctaVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 space-y-3"
            >
              <p className="text-center text-xs text-muted-foreground/70 uppercase tracking-[0.18em]">
                {c.ctaSub}
              </p>
              <button
                onClick={goDemo}
                className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-gradient-amber text-primary-foreground py-4 text-base font-medium shadow-glow hover:scale-[1.01] transition"
              >
                {c.cta1}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={goCreate}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border/60 bg-surface py-4 text-base text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
              >
                {c.cta2}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Welcome;
