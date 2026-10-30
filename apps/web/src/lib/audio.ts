import { TIER_SONIFICATION } from "@roomguide/core";
import type { HazardTier } from "@roomguide/core";

/**
 * Audio is the primary channel for this product, so it gets its own module rather than
 * being a side effect of a component. Two layers:
 *   1. spoken narration (SpeechSynthesis)
 *   2. a short tonal blip whose pitch encodes tier and whose stereo pan encodes bearing,
 *      so the user learns "something at arm's length to my left" before the words land.
 */

let ctx: AudioContext | null = null;

export function ensureAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
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

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  voice =
    voices.find((v) => /en-GB.*(Female|Serena|Kate)/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text: string, tier: HazardTier, interrupt: boolean): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = tier === "critical" ? 1.12 : 1.02;
  u.pitch = tier === "critical" ? 1.15 : tier === "caution" ? 1.0 : 0.88;
  u.volume = tier === "critical" ? 1 : 0.85;
  if (voice) u.voice = voice;
  synth.speak(u);
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function audioAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
