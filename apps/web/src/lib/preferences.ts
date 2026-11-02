/**
 * Listener preferences that must survive a reload. For a blind user the guide is
 * configured once and then trusted; losing the chosen detail level on refresh silently
 * changes what gets announced, which is worse than an extra setting to remember.
 */

import { detectLocale, isLocale, type Locale } from "./i18n";

export type DetailLevel = "critical" | "caution" | "all";
export type SpeechSpeed = "slow" | "normal" | "fast";

export interface Preferences {
  /** Spoken and visible language. Defaults to the device language on first run. */
  locale: Locale;
  /** Ambient narration only. Explicit commands (describe, repeat, help) always speak. */
  speechOn: boolean;
  /** Tonal cues: hazard blips plus state, scan, and staleness earcons. */
  earconsOn: boolean;
  detail: DetailLevel;
  speed: SpeechSpeed;
  /**
   * Suppresses SpeechSynthesis so an active screen reader is the only voice. The
   * interface then relies on its live regions instead of talking over them.
   */
  screenReaderMode: boolean;
  /** Set after the first Start so the welcome speech is not repeated every session. */
  onboarded: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  speechOn: true,
  earconsOn: true,
  detail: "all",
  speed: "normal",
  screenReaderMode: false,
  onboarded: false,
};

const STORAGE_KEY = "roomguide.preferences.v1";

function isDetail(v: unknown): v is DetailLevel {
  return v === "critical" || v === "caution" || v === "all";
}

function isSpeed(v: unknown): v is SpeechSpeed {
  return v === "slow" || v === "normal" || v === "fast";
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES, locale: detectLocale() };
    const p = JSON.parse(raw) as Partial<Preferences>;
    return {
      locale: isLocale(p.locale) ? p.locale : detectLocale(),
      speechOn: bool(p.speechOn, DEFAULT_PREFERENCES.speechOn),
      earconsOn: bool(p.earconsOn, DEFAULT_PREFERENCES.earconsOn),
      detail: isDetail(p.detail) ? p.detail : DEFAULT_PREFERENCES.detail,
      speed: isSpeed(p.speed) ? p.speed : DEFAULT_PREFERENCES.speed,
      screenReaderMode: bool(p.screenReaderMode, DEFAULT_PREFERENCES.screenReaderMode),
      onboarded: bool(p.onboarded, DEFAULT_PREFERENCES.onboarded),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, locale: detectLocale() };
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or a full quota: preferences stay session-only rather than break the guide.
  }
}
