// Speech recognition + synthesis utilities
// Uses ElevenLabs when VITE_ELEVENLABS_API_KEY is set, browser TTS as fallback

declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

// ── ElevenLabs voices ─────────────────────────────────────────────────────────
const EL_VOICE_FEMALE    = "EXAVITQu4vr4xnSDxMaL"; // Bella — soft, warm, emotional
const EL_VOICE_MALE      = "ErXwobaYiN019PkySvjV"; // Antoni — warm, clear, natural
const EL_NARRATOR_VOICE  = "21m00Tcm4TlvDq8ikWAM"; // Rachel — calm, cinematic narrator

const FEMALE_NAMES = new Set([
  "Sofia", "Christine", "Martha", "Sana", "Amina", "Elena", "Joan", "Marta",
  "Laura", "Ana", "Carmen", "Isabel", "María", "Claire", "Emma", "Sarah",
]);

export const getVoiceId = (characterName: string): string =>
  FEMALE_NAMES.has(characterName.split(" ")[0]) ? EL_VOICE_FEMALE : EL_VOICE_MALE;

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
  options?: { continuous?: boolean },
): SpeechRecognition | null {
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = options?.continuous ?? false;
  rec.interimResults = true;
  rec.lang = "en-US";

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
// Fetches the full narrator audio from ElevenLabs and returns a blob URL.
// Call on narrator screen mount so the audio is ready before playback starts.
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
          stability: 0.58,
          similarity_boost: 0.72,
          style: 0.0,
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

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function speakElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.78,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const audio = new Audio(url);
    opts?.onStart?.();
    audio.onended = () => { URL.revokeObjectURL(url); opts?.onEnd?.(); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); opts?.onEnd?.(); resolve(); };
    audio.play().catch(() => { opts?.onEnd?.(); resolve(); });
  });
}

// ── Browser TTS fallback ──────────────────────────────────────────────────────
function getBestBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Prefer neural / enhanced / Google voices — they sound much more natural
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

  // Voices load asynchronously — wait if not ready yet
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
    narrator?: boolean;
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
  },
): Promise<void> {
  // Narrator always uses browser TTS — different voice, avoids spending ElevenLabs credits on long text
  if (!opts?.narrator) {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
    if (apiKey) {
      const voiceId = getVoiceId(opts?.characterName ?? "");
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
  window.speechSynthesis?.cancel();
}
