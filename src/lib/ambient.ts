// Procedural ambient music via Web Audio API.
// No external audio files — pure synthesis per emotionalStatus.

export type AmbientStatus = "Heavy" | "Searching" | "Tender" | "Anxious" | "Withdrawn" | "Hopeful";

// ── Volume ────────────────────────────────────────────────────────────────────
// Extremely subtle — like music heard through a wall. Listener should not
// consciously notice it until it's muted.
const MASTER_VOL = 0.012;

// ── Reverb impulse response (decaying white noise) ───────────────────────────
function buildReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const node = ctx.createConvolver();
  node.buffer = buf;
  return node;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OscDef {
  freq: number;
  gain: number;
  // Optional fast-LFO for Anxious beating effect only
  nervousLfoRate?: number;
  nervousLfoDepth?: number;
  // Whether to schedule random breath pauses on this layer
  breathe?: boolean;
}

interface Preset {
  oscs: OscDef[];
  reverbDuration: number;
  reverbDecay: number;
  wetGain: number;
  // Global LPF cutoff — applied to all oscillators for warmth
  globalLpfFreq: number;
}

// ── Presets ───────────────────────────────────────────────────────────────────
// Slow environmental LFOs (8-12s period) are added automatically per oscillator
// in buildOsc — presets only declare character-defining exceptions (Anxious).
const PRESETS: Record<AmbientStatus, Preset> = {
  Heavy: {
    oscs: [
      { freq: 110,   gain: 0.55, breathe: true  },
      { freq: 146.8, gain: 0.22, breathe: false },
      { freq: 55,    gain: 0.32, breathe: true  },
    ],
    reverbDuration: 5.5, reverbDecay: 3.8, wetGain: 0.70, globalLpfFreq: 380,
  },
  Withdrawn: {
    oscs: [
      { freq: 98,    gain: 0.45, breathe: true },
      { freq: 130.8, gain: 0.18, breathe: true },
    ],
    reverbDuration: 6.5, reverbDecay: 4.2, wetGain: 0.82, globalLpfFreq: 260,
  },
  Anxious: {
    oscs: [
      { freq: 220,   gain: 0.38, nervousLfoRate: 0.26, nervousLfoDepth: 2.2, breathe: false },
      { freq: 224.5, gain: 0.22, nervousLfoRate: 0.31, nervousLfoDepth: 1.6, breathe: false },
      { freq: 329.6, gain: 0.14, breathe: true  },
    ],
    reverbDuration: 2.0, reverbDecay: 1.5, wetGain: 0.32, globalLpfFreq: 900,
  },
  Searching: {
    // Arpeggio handled in buildArpeggio — oscs[0].gain used there
    oscs: [{ freq: 246.9, gain: 0.48, breathe: true }],
    reverbDuration: 4.0, reverbDecay: 2.5, wetGain: 0.55, globalLpfFreq: 1100,
  },
  Tender: {
    oscs: [
      { freq: 261.6, gain: 0.42, breathe: true  }, // C4
      { freq: 392,   gain: 0.28, breathe: false },  // G4
      { freq: 196,   gain: 0.18, breathe: true  },  // G3
    ],
    reverbDuration: 4.0, reverbDecay: 2.5, wetGain: 0.52, globalLpfFreq: 700,
  },
  Hopeful: {
    oscs: [
      { freq: 293.7, gain: 0.32, breathe: false }, // D4
      { freq: 440,   gain: 0.26, breathe: true  }, // A4
      { freq: 587.3, gain: 0.16, breathe: false }, // D5
    ],
    reverbDuration: 3.5, reverbDecay: 2.2, wetGain: 0.42, globalLpfFreq: 1400,
  },
};

// ── Engine ────────────────────────────────────────────────────────────────────
class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];  // setInterval handles
  private toIds: ReturnType<typeof setTimeout>[] = [];    // setTimeout handles
  private muted = false;
  private currentStatus: AmbientStatus | null = null;

  private ensureCtx(): AudioContext | null {
    if (typeof AudioContext === "undefined" && typeof (window as any).webkitAudioContext === "undefined") return null;
    try {
      if (!this.ctx || this.ctx.state === "closed") {
        const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
        this.ctx = new Ctx() as AudioContext;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }

  start(status: AmbientStatus): void {
    if (this.currentStatus === status && this.master) return;
    this.teardown();

    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.currentStatus = status;

    const preset = PRESETS[status];

    // ── Master gain (fade-in over 4s) ──────────────────────────────────────
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(
      this.muted ? 0 : MASTER_VOL,
      ctx.currentTime + 4,
    );
    master.connect(ctx.destination);
    this.master = master;
    this.nodes.push(master);

    // ── Reverb (wet path) ──────────────────────────────────────────────────
    const reverb = buildReverb(ctx, preset.reverbDuration, preset.reverbDecay);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = preset.wetGain;
    reverb.connect(reverbGain);
    reverbGain.connect(master);
    this.nodes.push(reverb, reverbGain);

    // ── Global low-pass filter (warmth on all oscillators) ─────────────────
    // Soft, organic roll-off that removes the cold digital edge of sine waves.
    // Feeds both the dry path (→ master) and the wet path (→ reverb).
    const globalLpf = ctx.createBiquadFilter();
    globalLpf.type = "lowpass";
    globalLpf.frequency.value = preset.globalLpfFreq;
    globalLpf.Q.value = 0.5;
    globalLpf.connect(master);  // dry
    globalLpf.connect(reverb);  // wet input
    this.nodes.push(globalLpf);

    // ── Oscillator layers ──────────────────────────────────────────────────
    if (status === "Searching") {
      this.buildArpeggio(ctx, preset.oscs[0].gain, preset.oscs[0].breathe ?? false, globalLpf);
    } else {
      preset.oscs.forEach((def) => this.buildOsc(ctx, def, globalLpf));
    }
  }

  private buildOsc(ctx: AudioContext, def: OscDef, dest: AudioNode): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = def.freq;

    const gainNode = ctx.createGain();
    gainNode.gain.value = def.gain;

    // ── Slow environmental LFO (8–12 s period, unique per layer) ──────────
    // Each oscillator gets a different random period so the layers drift
    // independently and never sound perfectly synchronised.
    const envPeriod = 8 + Math.random() * 4;   // 8–12 s
    const envDepth  = def.freq * 0.0025;        // 0.25% pitch drift — near-imperceptible
    const envLfo = ctx.createOscillator();
    envLfo.type = "sine";
    envLfo.frequency.value = 1 / envPeriod;
    const envLfoGain = ctx.createGain();
    envLfoGain.gain.value = envDepth;
    envLfo.connect(envLfoGain);
    envLfoGain.connect(osc.frequency);
    envLfo.start();
    this.nodes.push(envLfo, envLfoGain);

    // ── Fast nervous LFO (Anxious only) ───────────────────────────────────
    if (def.nervousLfoRate && def.nervousLfoDepth) {
      const nervLfo = ctx.createOscillator();
      nervLfo.type = "sine";
      nervLfo.frequency.value = def.nervousLfoRate;
      const nervGain = ctx.createGain();
      nervGain.gain.value = def.nervousLfoDepth;
      nervLfo.connect(nervGain);
      nervGain.connect(osc.frequency);
      nervLfo.start();
      this.nodes.push(nervLfo, nervGain);
    }

    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start();
    this.nodes.push(osc, gainNode);

    // ── Breath pauses ──────────────────────────────────────────────────────
    if (def.breathe) {
      this.scheduleBreathe(ctx, gainNode, def.gain);
    }
  }

  // Randomly fades a layer to near-silence for 0.6–2 s every 12–30 s,
  // giving the texture a living, breathing quality.
  private scheduleBreathe(ctx: AudioContext, gainNode: GainNode, baseGain: number): void {
    const tick = () => {
      const waitMs = (12 + Math.random() * 18) * 1000; // next breath in 12–30 s
      const id = setTimeout(() => {
        gainNode.gain.setTargetAtTime(baseGain * 0.04, ctx.currentTime, 0.15);
        const pauseMs = 600 + Math.random() * 1400;     // hold 0.6–2 s
        const resumeId = setTimeout(() => {
          gainNode.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.30);
          tick(); // schedule the next breath
        }, pauseMs);
        this.toIds.push(resumeId);
      }, waitMs);
      this.toIds.push(id);
    };
    tick();
  }

  private buildArpeggio(
    ctx: AudioContext,
    gain: number,
    breathe: boolean,
    dest: AudioNode,
  ): void {
    const freqs = [246.9, 293.7, 329.6, 392.0]; // B3 → D4 → E4 → G4
    let step = 0;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freqs[0];

    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;

    // Environmental LFO for the arpeggio oscillator
    const envPeriod = 10 + Math.random() * 2;
    const envLfo = ctx.createOscillator();
    envLfo.type = "sine";
    envLfo.frequency.value = 1 / envPeriod;
    const envLfoGain = ctx.createGain();
    envLfoGain.gain.value = freqs[0] * 0.0025;
    envLfo.connect(envLfoGain);
    envLfoGain.connect(osc.frequency);
    envLfo.start();
    this.nodes.push(envLfo, envLfoGain);

    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start();
    this.nodes.push(osc, gainNode);

    const timer = setInterval(() => {
      step = (step + 1) % freqs.length;
      osc.frequency.setTargetAtTime(freqs[step], ctx.currentTime, 0.55);
    }, 4200);
    this.timers.push(timer);

    if (breathe) this.scheduleBreathe(ctx, gainNode, gain);
  }

  private teardown(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.toIds.forEach(clearTimeout);
    this.toIds = [];

    if (this.master && this.ctx) {
      const master = this.master;
      const ctx = this.ctx;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    }
    const toDisconnect = [...this.nodes];
    setTimeout(() => {
      toDisconnect.forEach((n) => { try { n.disconnect(); } catch {} });
    }, 1800);
    this.nodes = [];
    this.master = null;
    this.currentStatus = null;
  }

  stop(): void {
    this.teardown();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : MASTER_VOL,
        this.ctx.currentTime,
        0.35,
      );
    }
  }
}

export const ambient = new AmbientEngine();
