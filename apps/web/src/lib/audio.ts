import { TIER_SONIFICATION } from "@roomguide/core";
import type { HazardTier } from "@roomguide/core";
import type { SpeechSpeed } from "./preferences";
import { LOCALE_TAGS, type Locale } from "./i18n";

/**
 * Audio is the primary channel for this product, so it gets its own module rather than
 * being a side effect of a component. Three layers:
 *   1. spoken narration (SpeechSynthesis)
 *   2. a short tonal blip whose pitch encodes tier and whose stereo pan encodes bearing,
 *      so the user learns "something at arm's length to my left" before the words land
 *   3. state earcons — start, pause, scan complete, staleness, failure — so the guide's
 *      condition is audible without looking at it.
 */

let ctx: AudioContext | null = null;
let speechSpeed: SpeechSpeed = "normal";
let earconsOn = true;

export function setAudioPreferences(prefs: {
  speed: SpeechSpeed;
  earconsOn: boolean;
  locale?: Locale;
}): void {
  speechSpeed = prefs.speed;
  earconsOn = prefs.earconsOn;
  if (prefs.locale) setSpeechLanguage(prefs.locale);
}

export function ensureAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
}

interface ToneSpec {
  hz: number;
  /** Seconds from now. */
  at: number;
  /** Seconds. */
  dur: number;
  gain: number;
  type?: OscillatorType;
  endHz?: number;
}

function playTones(tones: ToneSpec[]): void {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const base = ctx.currentTime;

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.hz, base + t.at);
    if (t.endHz !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(t.endHz, base + t.at + t.dur);
    }

    gain.gain.setValueAtTime(0, base + t.at);
    gain.gain.linearRampToValueAtTime(t.gain, base + t.at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, base + t.at + t.dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(base + t.at);
    osc.stop(base + t.at + t.dur + 0.02);
  }
}

export function blip(tier: HazardTier, bearingDeg: number): void {
  if (!ctx) return;
  const { baseHz, panRange } = TIER_SONIFICATION[tier];
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

  osc.type = tier === "critical" ? "square" : "sine";
  osc.frequency.setValueAtTime(baseHz, now);
  if (tier === "critical") osc.frequency.linearRampToValueAtTime(baseHz * 0.72, now + 0.16);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(tier === "critical" ? 0.16 : 0.1, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

  if (pan) pan.pan.value = Math.max(-1, Math.min(1, (bearingDeg / 45) * panRange));

  osc.connect(gain);
  if (pan) gain.connect(pan).connect(ctx.destination);
  else gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

export type EarconKind = "start" | "stop" | "ready" | "scan" | "stale" | "error";

/**
 * State cues, deliberately short and low-energy except for failure. A scan pulse fires
 * every few seconds, so anything musical would become noise within a minute.
 */
export function earcon(kind: EarconKind): void {
  if (!earconsOn) return;
  ensureAudio();
  if (!ctx) return;

  switch (kind) {
    case "start":
      playTones([
        { hz: 523.25, at: 0, dur: 0.09, gain: 0.07 },
        { hz: 783.99, at: 0.1, dur: 0.16, gain: 0.08 },
      ]);
      break;
    case "stop":
      playTones([
        { hz: 659.25, at: 0, dur: 0.09, gain: 0.06 },
        { hz: 440, at: 0.1, dur: 0.16, gain: 0.06 },
      ]);
      break;
    case "ready":
      playTones([
        { hz: 392, at: 0, dur: 0.08, gain: 0.06 },
        { hz: 587.33, at: 0.09, dur: 0.14, gain: 0.07 },
      ]);
      break;
    case "scan":
      // A single soft ping: the sweep finished, the picture is fresh again.
      playTones([{ hz: 1318.51, at: 0, dur: 0.06, gain: 0.04 }]);
      break;
    case "stale":
      // Low, repeated, and clearly not speech — "the picture you are hearing is old".
      playTones([
        { hz: 196, at: 0, dur: 0.18, gain: 0.09, type: "triangle" },
        { hz: 146.83, at: 0.22, dur: 0.22, gain: 0.08, type: "triangle" },
      ]);
      break;
    case "error":
      playTones([
        { hz: 220, at: 0, dur: 0.16, gain: 0.07, type: "sawtooth", endHz: 164.81 },
      ]);
      break;
  }
}

/**
 * Aim coaching: one short tick per adjustment step. Pitch rises as the phone gets closer
 * to level and stereo pan follows the roll error, so the user can chase the tone without
 * listening to words. Ticks stop at level, which is the signal to hold still.
 */
export function aimTick(errorNorm: number, pan: number): void {
  if (!earconsOn) return;
  ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const err = Math.max(0, Math.min(1, errorNorm));
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

  osc.type = "sine";
  osc.frequency.setValueAtTime(392 + (1 - err) * 392, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  if (panner) panner.pan.value = Math.max(-1, Math.min(1, pan));

  osc.connect(gain);
  if (panner) gain.connect(panner).connect(ctx.destination);
  else gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

export function levelChime(): void {
  if (!earconsOn) return;
  ensureAudio();
  if (!ctx) return;
  playTones([
    { hz: 659.25, at: 0, dur: 0.1, gain: 0.06 },
    { hz: 987.77, at: 0.11, dur: 0.18, gain: 0.07 },
  ]);
}

let voice: SpeechSynthesisVoice | null = null;
let speechLocale: Locale = "en";

/**
 * Rank installed voices for the active language. Exact tag wins, then same primary
 * subtag, then local over network voices (they respond faster and survive offline).
 * English keeps the original preference for a warm en-GB female voice.
 */
function scoreVoice(v: SpeechSynthesisVoice, locale: Locale): number {
  const tag = LOCALE_TAGS[locale].toLowerCase();
  const lang = v.lang.toLowerCase().replace("_", "-");
  let score: number;
  if (lang === tag) score = 4;
  else if (lang.split("-")[0] === tag.split("-")[0]) score = 2;
  else return -1;
  if (v.localService) score += 1;
  if (locale === "en" && /en-GB.*(Female|Serena|Kate)/i.test(v.name)) score += 2;
  return score;
}

function pickVoice(): void {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = scoreVoice(v, speechLocale);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  voice = bestScore >= 0 ? best : null;
}

export function setSpeechLanguage(locale: Locale): void {
  if (locale === speechLocale) return;
  speechLocale = locale;
  pickVoice();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

const RATE: Record<SpeechSpeed, number> = { slow: 0.9, normal: 1.02, fast: 1.18 };

export function speak(text: string, tier: HazardTier, interrupt: boolean): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  // Speed is a listener preference; the tier only nudges urgency on top of it.
  u.rate = RATE[speechSpeed] + (tier === "critical" ? 0.08 : 0);
  u.pitch = tier === "critical" ? 1.15 : tier === "caution" ? 1.0 : 0.88;
  u.volume = tier === "critical" ? 1 : 0.85;
  u.lang = LOCALE_TAGS[speechLocale];
  if (voice) u.voice = voice;
  synth.speak(u);
}

/** System and state messages use one calm voice; they are not scene descriptions. */
export function announce(text: string, interrupt = false): void {
  speak(text, "informative", interrupt);
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function audioAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
