// Speech recognition + synthesis utilities
// Uses ElevenLabs when VITE_ELEVENLABS_API_KEY is set, browser TTS as fallback

declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

// ── ElevenLabs voices — indexed by language ───────────────────────────────────
// [female voice ID, male voice ID]
// Voices chosen for conversational naturalness, not theatricality.
// All used with eleven_multilingual_v2 + style=0.25 for calm, human delivery.
const EL_VOICES: Record<string, [string, string]> = {
  en: [
    "21m00Tcm4TlvDq8ikWAM", // Rachel — calm, warm, conversational
    "TX3LPaxC6zFa8vFCBzvvA", // Liam  — neutral, American, young
  ],
  es: [
    "z9fAnlkpzviPz146aGWa", // Glinda  — middle-aged, excels in Spanish
    "pNInz6obpgDQGcFmaJgB", // Adam    — deep, performs well in Spanish
  ],
  fr: [
    "pMsXgVXv3BLzUgSXRplE", // Serena  — pleasant middle-aged, French-capable
    "JBFqnCBsd6RMkjVDRZzb", // George  — middle-aged British, handles French well
  ],
  it: [
    "ThT5KcBeYPX3keUQqHPh", // Dorothy — pleasant, British intonation adapts to Italian
    "IKne3meq5aSn9XLyUdCD", // Charlie — casual, conversational, less theatrical
  ],
};

const EL_NARRATOR_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel — calm cinematic narrator

const FEMALE_NAMES = new Set([
  "Sofia", "Christine", "Martha", "Sana", "Amina", "Elena", "Joan", "Marta",
  "Laura", "Ana", "Carmen", "Isabel", "María", "Claire", "Emma", "Sarah", "Noa",
]);

// Country code (last segment of location string) → UI language
const COUNTRY_TO_LANG: Record<string, string> = {
  ES: "es", AR: "es", MX: "es", CO: "es", CL: "es", PE: "es", VE: "es", UY: "es",
  España: "es", Spain: "es",
  FR: "fr",
  IT: "it",
};

// Derives the character's spoken language from their location string.
// Fallback to "en" for any country not in the map (e.g. UK, US, PT, CA…).
export function locationToLang(location: string): string {
  const parts = location.split(",");
  const code = parts[parts.length - 1].trim();
  return COUNTRY_TO_LANG[code] ?? "en";
}

export const getVoiceId = (characterName: string, lang = "en"): string => {
  const [female, male] = EL_VOICES[lang] ?? EL_VOICES.en;
  return FEMALE_NAMES.has(characterName.split(" ")[0]) ? female : male;
};

// Language → browser speech recognition locale
const REC_LANGS: Record<string, string> = {
  en: "en-US", es: "es-ES", it: "it-IT", fr: "fr-FR",
};

// ── Support checks ────────────────────────────────────────────────────────────
export const isSpeechSupported = (): boolean =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export const isTTSSupported = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

// ── Speech recognition ────────────────────────────────────────────────────────
export function startRecognition(
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onEnd: () => void,
  options?: { continuous?: boolean; lang?: string },
): SpeechRecognition | null {
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = options?.continuous ?? false;
  rec.interimResults = true;
  rec.lang = REC_LANGS[options?.lang ?? "en"] ?? "en-US";

  rec.onresult = (e) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (final) onFinal(final.trim());
    else if (interim) onInterim(interim.trim());
  };

  rec.onend = onEnd;
  rec.onerror = () => onEnd();

  try { rec.start(); } catch { return null; }
  return rec;
}

// ── Narrator audio pre-fetch ─────────────────────────────────────────────────
export async function fetchNarratorAudio(text: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_NARRATOR_VOICE}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.10,
          use_speaker_boost: true,
        },
      }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// ── Voice settings preset ─────────────────────────────────────────────────────
// Natural, human delivery — not theatrical.
// stability 0.45-0.55: consistent without robotic flatness
// similarity_boost 0.75: close to the voice without artifacts
// style 0.25: expressive enough to feel human, not enough to sound like an actor
type EmotionalStatus = "Heavy" | "Searching" | "Tender" | "Anxious" | "Withdrawn" | "Hopeful";

const EMOTION_PRESETS: Record<EmotionalStatus, { stability: number; similarity_boost: number; style: number }> = {
  Heavy:     { stability: 0.48, similarity_boost: 0.75, style: 0.25 },
  Tender:    { stability: 0.45, similarity_boost: 0.75, style: 0.25 },
  Anxious:   { stability: 0.45, similarity_boost: 0.75, style: 0.25 },
  Withdrawn: { stability: 0.55, similarity_boost: 0.75, style: 0.20 },
  Searching: { stability: 0.50, similarity_boost: 0.75, style: 0.25 },
  Hopeful:   { stability: 0.50, similarity_boost: 0.75, style: 0.25 },
};

// Tracks the active ElevenLabs Audio element so stopSpeaking() can kill it
let activeELAudio: HTMLAudioElement | null = null;

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function speakElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string,
  opts?: { onStart?: () => void; onEnd?: () => void; emotionalStatus?: string },
): Promise<void> {
  const preset = EMOTION_PRESETS[(opts?.emotionalStatus as EmotionalStatus) ?? "Searching"] ?? EMOTION_PRESETS.Searching;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        ...preset,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const audio = new Audio(url);
    activeELAudio = audio;
    opts?.onStart?.();
    const cleanup = () => { URL.revokeObjectURL(url); activeELAudio = null; };
    audio.onended = () => { cleanup(); opts?.onEnd?.(); resolve(); };
    audio.onerror = () => { cleanup(); opts?.onEnd?.(); resolve(); };
    audio.play().catch(() => { cleanup(); opts?.onEnd?.(); resolve(); });
  });
}

// ── Browser TTS fallback ──────────────────────────────────────────────────────
function getBestBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.name.includes("Neural") && v.lang.startsWith("en")) ??
    voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ??
    voices.find((v) => v.name.includes("Enhanced") && v.lang.startsWith("en")) ??
    voices.find((v) => v.lang.startsWith("en-US")) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  );
}

function speakBrowser(
  text: string,
  opts?: { rate?: number; onStart?: () => void; onEnd?: () => void },
): void {
  if (!isTTSSupported()) { opts?.onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 0.88;
  u.pitch = 1.0;

  const assign = () => {
    const voice = getBestBrowserVoice();
    if (voice) u.voice = voice;
  };
  if (window.speechSynthesis.getVoices().length > 0) {
    assign();
  } else {
    window.speechSynthesis.onvoiceschanged = assign;
  }

  if (opts?.onStart) u.onstart = opts.onStart;
  if (opts?.onEnd) u.onend = opts.onEnd;
  window.speechSynthesis.speak(u);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function speakText(
  text: string,
  opts?: {
    characterName?: string;
    gender?: "female" | "male";
    emotionalStatus?: string;
    narrator?: boolean;
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    lang?: string; // character's derived language (from location), or UI lang
  },
): Promise<void> {
  if (!opts?.narrator) {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
    if (apiKey) {
      const effectiveLang = opts?.lang ?? "en";
      const [femaleVoice, maleVoice] = EL_VOICES[effectiveLang] ?? EL_VOICES.en;
      const voiceId = opts?.gender === "female" ? femaleVoice
        : opts?.gender === "male" ? maleVoice
        : getVoiceId(opts?.characterName ?? "", effectiveLang);
      try {
        await speakElevenLabs(text, voiceId, apiKey, opts);
        return;
      } catch {
        // ElevenLabs failed — fall through to browser TTS
      }
    }
  }

  speakBrowser(text, { ...opts, rate: opts?.rate ?? (opts?.narrator ? 0.82 : 0.88) });
}

export function stopSpeaking(): void {
  if (activeELAudio) {
    activeELAudio.pause();
    activeELAudio = null;
  }
  window.speechSynthesis?.cancel();
}
