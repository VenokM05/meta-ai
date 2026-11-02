import type { HazardTier, NarrationLine, SpatialObject } from "@roomguide/core";
import type { DetailLevel, SpeechSpeed } from "./preferences";

/**
 * Localization for the live guide. English keeps the canonical sentences produced by
 * @roomguide/core; other locales rebuild the same facts from the structured NarrationLine
 * fields (concept, count, distanceM, bearingDeg, trigger), so hazard meaning never drifts
 * between languages.
 *
 * Telemetry panels stay in English: they are engineering evidence for judges, not the
 * walking experience. The spoken guide is fully localized.
 */

export type Locale = "en" | "es" | "fr" | "pt" | "de";

export interface LocaleSpec {
  id: Locale;
  /** Autonym, shown in the language picker. */
  label: string;
  /** BCP-47 tag used for SpeechSynthesisUtterance.lang. */
  tag: string;
}

export const LOCALES: LocaleSpec[] = [
  { id: "en", label: "English", tag: "en-US" },
  { id: "es", label: "Español", tag: "es-ES" },
  { id: "fr", label: "Français", tag: "fr-FR" },
  { id: "pt", label: "Português", tag: "pt-BR" },
  { id: "de", label: "Deutsch", tag: "de-DE" },
];

export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-BR",
  de: "de-DE",
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "es" || value === "fr" || value === "pt" || value === "de";
}

/** Device language on first run; unsupported languages fall back to English. */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

interface Noun {
  one: string;
  many: string;
  display: string;
}

const NOUNS: Record<Locale, Record<string, Noun>> = {
  en: {
    stairs: { one: "stairs", many: "stairs", display: "Stairs" },
    step: { one: "step", many: "steps", display: "Step" },
    gap: { one: "gap", many: "gaps", display: "Gap" },
    cord: { one: "cord", many: "cords", display: "Cord" },
    person: { one: "person", many: "people", display: "Person" },
    open_door: { one: "open door", many: "open doors", display: "Open door" },
    crossing: { one: "crossing", many: "crossings", display: "Crossing" },
    curb: { one: "curb", many: "curbs", display: "Curb" },
    chair: { one: "chair", many: "chairs", display: "Chair" },
    pole: { one: "pole", many: "poles", display: "Pole" },
    cup_liquid: { one: "cup of liquid", many: "cups of liquid", display: "Cup of liquid" },
    doorway: { one: "doorway", many: "doorways", display: "Doorway" },
  },
  es: {
    stairs: { one: "Escaleras", many: "Escaleras", display: "Escaleras" },
    step: { one: "Escalón", many: "Escalones", display: "Escalón" },
    gap: { one: "Hueco", many: "Huecos", display: "Hueco" },
    cord: { one: "Cable", many: "Cables", display: "Cable" },
    person: { one: "Persona", many: "Personas", display: "Persona" },
    open_door: { one: "Puerta abierta", many: "Puertas abiertas", display: "Puerta abierta" },
    crossing: { one: "Paso de cebra", many: "Pasos de cebra", display: "Paso de cebra" },
    curb: { one: "Bordillo", many: "Bordillos", display: "Bordillo" },
    chair: { one: "Silla", many: "Sillas", display: "Silla" },
    pole: { one: "Poste", many: "Postes", display: "Poste" },
    cup_liquid: { one: "Vaso con líquido", many: "Vasos con líquido", display: "Vaso con líquido" },
    doorway: { one: "Marco de puerta", many: "Marcos de puerta", display: "Marco de puerta" },
  },
  fr: {
    stairs: { one: "Escalier", many: "Escaliers", display: "Escalier" },
    step: { one: "Marche", many: "Marches", display: "Marche" },
    gap: { one: "Trou", many: "Trous", display: "Trou" },
    cord: { one: "Câble", many: "Câbles", display: "Câble" },
    person: { one: "Personne", many: "Personnes", display: "Personne" },
    open_door: { one: "Porte ouverte", many: "Portes ouvertes", display: "Porte ouverte" },
    crossing: { one: "Passage piéton", many: "Passages piétons", display: "Passage piéton" },
    curb: { one: "Bordure", many: "Bordures", display: "Bordure" },
    chair: { one: "Chaise", many: "Chaises", display: "Chaise" },
    pole: { one: "Poteau", many: "Poteaux", display: "Poteau" },
    cup_liquid: { one: "Verre rempli", many: "Verres remplis", display: "Verre rempli" },
    doorway: { one: "Encadrement de porte", many: "Encadrements de porte", display: "Encadrement de porte" },
  },
  pt: {
    stairs: { one: "Escada", many: "Escadas", display: "Escada" },
    step: { one: "Degrau", many: "Degraus", display: "Degrau" },
    gap: { one: "Buraco", many: "Buracos", display: "Buraco" },
    cord: { one: "Cabo", many: "Cabos", display: "Cabo" },
    person: { one: "Pessoa", many: "Pessoas", display: "Pessoa" },
    open_door: { one: "Porta aberta", many: "Portas abertas", display: "Porta aberta" },
    crossing: { one: "Faixa de pedestres", many: "Faixas de pedestres", display: "Faixa de pedestres" },
    curb: { one: "Meio-fio", many: "Meios-fios", display: "Meio-fio" },
    chair: { one: "Cadeira", many: "Cadeiras", display: "Cadeira" },
    pole: { one: "Poste", many: "Postes", display: "Poste" },
    cup_liquid: { one: "Copo com líquido", many: "Copos com líquido", display: "Copo com líquido" },
    doorway: { one: "Batente", many: "Batentes", display: "Batente" },
  },
  de: {
    stairs: { one: "Treppe", many: "Treppen", display: "Treppe" },
    step: { one: "Stufe", many: "Stufen", display: "Stufe" },
    gap: { one: "Lücke", many: "Lücken", display: "Lücke" },
    cord: { one: "Kabel", many: "Kabel", display: "Kabel" },
    person: { one: "Person", many: "Personen", display: "Person" },
    open_door: { one: "Offene Tür", many: "Offene Türen", display: "Offene Tür" },
    crossing: { one: "Übergang", many: "Übergänge", display: "Übergang" },
    curb: { one: "Bordstein", many: "Bordsteine", display: "Bordstein" },
    chair: { one: "Stuhl", many: "Stühle", display: "Stuhl" },
    pole: { one: "Pfosten", many: "Pfosten", display: "Pfosten" },
    cup_liquid: { one: "Becher mit Flüssigkeit", many: "Becher mit Flüssigkeit", display: "Becher mit Flüssigkeit" },
    doorway: { one: "Türrahmen", many: "Türrahmen", display: "Türrahmen" },
  },
};

const DISTANCE: Record<Locale, (distanceM: number | null) => string> = {
  en: (m) => (m === null ? "ahead" : m < 0.9 ? "at your feet" : m < 1.6 ? "one step ahead" : m < 2.6 ? "a few steps ahead" : m < 4 ? "further ahead" : "in the distance"),
  es: (m) => (m === null ? "delante" : m < 0.9 ? "bajo sus pies" : m < 1.6 ? "a un paso" : m < 2.6 ? "a unos pasos" : m < 4 ? "más adelante" : "a lo lejos"),
  fr: (m) => (m === null ? "devant" : m < 0.9 ? "à vos pieds" : m < 1.6 ? "à un pas" : m < 2.6 ? "à quelques pas" : m < 4 ? "plus loin" : "au loin"),
  pt: (m) => (m === null ? "à frente" : m < 0.9 ? "aos seus pés" : m < 1.6 ? "a um passo" : m < 2.6 ? "a alguns passos" : m < 4 ? "mais adiante" : "ao longe"),
  de: (m) => (m === null ? "voraus" : m < 0.9 ? "vor Ihnen" : m < 1.6 ? "einen Schritt entfernt" : m < 2.6 ? "ein paar Schritte entfernt" : m < 4 ? "weiter voraus" : "in der Ferne"),
};

function bearingFor(locale: Locale, deg: number): string {
  const a = Math.abs(deg);
  const left = deg < 0;
  switch (locale) {
    case "en":
      if (a < 8) return "straight ahead";
      if (a < 25) return `slightly ${left ? "left" : "right"}`;
      if (a < 45) return left ? "left" : "right";
      return `well to your ${left ? "left" : "right"}`;
    case "es":
      if (a < 8) return "justo delante";
      if (a < 25) return `ligeramente a la ${left ? "izquierda" : "derecha"}`;
      if (a < 45) return `a la ${left ? "izquierda" : "derecha"}`;
      return `muy a la ${left ? "izquierda" : "derecha"}`;
    case "fr":
      if (a < 8) return "droit devant";
      if (a < 25) return `légèrement à ${left ? "gauche" : "droite"}`;
      if (a < 45) return `à ${left ? "gauche" : "droite"}`;
      return `bien à votre ${left ? "gauche" : "droite"}`;
    case "pt":
      if (a < 8) return "em frente";
      if (a < 25) return `ligeiramente à ${left ? "esquerda" : "direita"}`;
      if (a < 45) return `à ${left ? "esquerda" : "direita"}`;
      return `bem à sua ${left ? "esquerda" : "direita"}`;
    case "de":
      if (a < 8) return "direkt voraus";
      if (a < 25) return `leicht ${left ? "links" : "rechts"}`;
      if (a < 45) return left ? "links" : "rechts";
      return `weit ${left ? "links" : "rechts"}`;
  }
}

const CLOSER: Record<Locale, string> = {
  en: "Moving closer: ",
  es: "Más cerca: ",
  fr: "Plus près : ",
  pt: "Mais perto: ",
  de: "Nähert sich: ",
};

function nounFor(locale: Locale, concept: string): Noun | null {
  return NOUNS[locale][concept] ?? null;
}

export function conceptLabel(concept: string, locale: Locale, fallback = concept): string {
  return nounFor(locale, concept)?.display ?? fallback;
}

/**
 * Rebuild a scene sentence for a locale. English and manual summaries keep the canonical
 * text; every other language is assembled from the structured fields.
 */
export function lineText(line: NarrationLine, locale: Locale): string {
  if (locale === "en" || line.concept === "summary") return line.text;
  const noun = nounFor(locale, line.concept);
  if (!noun) return line.text;

  const amount = line.count > 1 ? `${line.count} ${noun.many}` : noun.one;
  const body = `${amount}, ${DISTANCE[locale](line.distanceM)}, ${bearingFor(locale, line.bearingDeg)}.`;
  return line.trigger === "approaching" ? `${CLOSER[locale]}${body}` : body;
}

/** Localized describe-now summary. Mirrors core's honesty rule: absence is never asserted. */
export function describeSummary(
  objects: SpatialObject[],
  locale: Locale,
  fallback: string,
): string {
  if (locale === "en") return fallback;
  const t = UI[locale];
  if (objects.length === 0) return t.summaryEmpty;
  const critical = objects.filter((o) => o.tier === "critical").length;
  const top = objects[0];
  const head = critical > 0 ? `${t.summaryHazards(critical)} ` : "";
  // summaryNearest already ends its sentence; German nouns keep their capital.
  return `${head}${t.summaryNearest(top ? conceptLabel(top.concept, locale) : t.summaryNone)}`;
}

/** Localized tier names for legends and tags. */
export function tierLabel(tier: HazardTier, locale: Locale): string {
  return UI[locale].tier[tier];
}

export interface HelpKey {
  keys: string;
  action: string;
}

export interface AimStrings {
  on: string;
  off: string;
  level: string;
  levelHold: string;
  holdUpright: string;
  topUp: string;
  topDown: string;
  rightSide: string;
  leftSide: string;
  almost: string;
  noCamera: string;
  noSensors: string;
  denied: string;
  unavailable: string;
  cameraOff: string;
  pitchRoll: (pitch: number, roll: number) => string;
}

export interface GuideStrings {
  skipLink: string;
  navPrimary: string;
  navGuide: string;
  navFrame: string;
  navQuality: string;
  footerTagline: string;

  asideLabel: string;
  standfirst: string;
  tier: Record<HazardTier, string>;
  corridorNote: string;
  legendAria: string;
  stageAria: string;
  feedSynthetic: string;
  feedLive: string;

  start: string;
  pause: string;
  describe: string;
  repeat: string;
  narrationOn: string;
  narrationOff: string;
  /**
   * Phone dock labels. Five columns on a 320px screen leave ~58px each, so these
   * are deliberately shorter than the page buttons. The page keeps the long forms.
   */
  dockDescribe: string;
  dockRepeat: string;
  dockNarrationOn: string;
  dockNarrationOff: string;
  useCamera: string;
  useSynthetic: string;
  aimCoach: string;
  stopAiming: string;
  aimTitle: string;
  help: string;
  resetSession: string;
  close: string;
  dismiss: string;

  voiceScanning: string;
  voiceStopped: string;
  shortcutNote: string;

  audioSettings: string;
  detailLabel: string;
  detailCriticalOption: string;
  detailCautionOption: string;
  detailAllOption: string;
  speedLabel: string;
  speedSlowOption: string;
  speedNormalOption: string;
  speedFastOption: string;
  languageLabel: string;
  languageHint: string;
  earconsLabel: string;
  earconsHint: string;
  screenReaderLabel: string;
  screenReaderHint: string;
  detailNote: string;

  helpTitle: string;
  helpLead: string;
  helpKeys: HelpKey[];
  helpNoteDetail: string;
  helpNoteAim: string;
  helpSpoken: string;

  spokenNow: string;
  pausedNow: string;
  lineCount: (n: number) => string;
  listening: string;
  notRunning: string;
  trigger: Record<NarrationLine["trigger"], string>;
  logTitle: string;
  logEmpty: string;
  logOnlyLine: string;
  logLines: (n: number) => string;

  welcome: string;
  started: string;
  guidePaused: string;
  guideReset: string;
  stale: (seconds: number) => string;
  cameraOff: string;
  cameraReady: string;
  cameraUnavailable: string;
  cameraDenied: string;
  cameraBusy: string;
  cameraMissing: string;
  cameraInsecure: string;
  syntheticNotice: string;
  nothingToRepeat: string;
  narrationSpeechOn: string;
  narrationSpeechOff: string;
  detailSpoken: Record<DetailLevel, string>;
  speedSpoken: Record<SpeechSpeed, string>;
  earconsOnSpeech: string;
  earconsOffSpeech: string;
  screenReaderOn: string;
  screenReaderOff: string;
  languageSpeech: (label: string) => string;
  degradedProxy: string;
  degradedTimeout: (seconds: number) => string;
  degradedAborted: string;
  degradedUnavailable: (reason: string) => string;
  partialFailure: (labels: string) => string;

  summaryEmpty: string;
  summaryHazards: (n: number) => string;
  summaryNearest: (label: string) => string;
  summaryNone: string;

  aim: AimStrings;
}

const EN_KEYS: HelpKey[] = [
  { keys: "Space", action: "Start or pause the guide" },
  { keys: "D", action: "Describe the current view" },
  { keys: "R", action: "Repeat the last announcement" },
  { keys: "S", action: "Automatic narration on or off" },
  { keys: "1 / 2 / 3", action: "Detail: critical only · critical + caution · everything" },
  { keys: "A", action: "Aim coach: level the phone with tones" },
  { keys: "H", action: "Open or close this help" },
  { keys: "Esc", action: "Close help, or stop the guide" },
];

export const UI: Record<Locale, GuideStrings> = {
  en: {
    skipLink: "Skip to main content",
    navPrimary: "Primary",
    navGuide: "Live guide",
    navFrame: "Single frame",
    navQuality: "Quality",
    footerTagline: "Geometry turned into speech. Absence is never asserted.",

    asideLabel: "Narration and controls",
    standfirst: "A periodic scan of what is ahead. It describes what it sees, and never claims the path is clear.",
    tier: { critical: "Critical", caution: "Caution", informative: "Informative" },
    corridorNote: "Dashed corridor marks the path ahead",
    legendAria: "Hazard tiers",
    stageAria: "Segmented view of the scene",
    feedSynthetic: "Synthetic feed",
    feedLive: "Live camera",

    start: "Start guide",
    pause: "Pause guide",
    describe: "Describe now",
    repeat: "Repeat last",
    narrationOn: "Narration on",
    narrationOff: "Narration off",
    dockDescribe: "Describe",
    dockRepeat: "Repeat",
    dockNarrationOn: "Narration",
    dockNarrationOff: "Muted",
    useCamera: "Use my camera",
    useSynthetic: "Use synthetic",
    aimCoach: "Aim coach",
    stopAiming: "Stop aiming",
    aimTitle: "Level the phone with orientation tones. Needs the camera and a device with motion sensors.",
    help: "Help",
    resetSession: "Reset session",
    close: "Close",
    dismiss: "Dismiss",

    voiceScanning: "Scanning.",
    voiceStopped: "Stopped.",
    shortcutNote: "Space start or pause · D describe · R repeat · 1–3 detail · S narration · A aim · H help",

    audioSettings: "Audio settings",
    detailLabel: "Detail",
    detailCriticalOption: "Critical only",
    detailCautionOption: "Critical + caution",
    detailAllOption: "Everything",
    speedLabel: "Speech speed",
    speedSlowOption: "Slow",
    speedNormalOption: "Normal",
    speedFastOption: "Fast",
    languageLabel: "Spoken language",
    languageHint: "Uses the best installed voice for this language on your device.",
    earconsLabel: "Earcons",
    earconsHint: "Hazard blips, scan ping, and the stale-view thud.",
    screenReaderLabel: "Screen reader mode",
    screenReaderHint: "Keep the guide silent and leave speech to your screen reader.",
    detailNote: "Detail filters what is spoken, not what is detected.",

    helpTitle: "How to use Room Guide",
    helpLead:
      "Start with Space, or the Start guide button. Room Guide scans the view ahead every few seconds and speaks what it finds. It describes what it sees; it never claims the path is clear. Every command below also has a button.",
    helpKeys: EN_KEYS,
    helpNoteDetail:
      "Detail filters narration, not detection. A hazard outside the chosen detail level is still seen and still drawn — it is simply not spoken. Automatic narration can be muted with S, but explicit commands and system warnings still answer. If you use a screen reader, turn on Screen reader mode in Audio settings so the two voices do not compete.",
    helpNoteAim:
      "Aim coach needs the camera on and a phone or tablet with motion sensors; on iPhone it asks for motion access. Higher ticks mean closer to level, and the ticks stop at level. Level means the phone is level — not that the path is clear.",
    helpSpoken:
      "Room Guide. Space starts or pauses. D describes the view now. R repeats the last announcement. S turns automatic narration on or off. One, two, or three sets detail: critical only, critical and caution, or everything. A starts or stops aim coaching. H opens or closes this help. Escape closes help, or stops the guide. Every command below also has a button. Earcons: a rising pair means start, a falling pair means pause, one soft ping means a fresh scan, and a low double thud means the view is stale. Aim coaching needs the camera on and a phone or tablet with motion sensors. Level means the phone is level, not that the path is clear. The guide never says the path is clear.",

    spokenNow: "Spoken now",
    pausedNow: "Paused",
    lineCount: (n) => `${n} ${n === 1 ? "line" : "lines"}`,
    listening: "Listening. Nothing new to report.",
    notRunning: "Not running.",
    trigger: {
      new: "first seen",
      approaching: "closing in",
      reappeared: "came back",
      manual: "on request",
    },
    logTitle: "Narration log",
    logEmpty: "No narration yet. Start the guide and every spoken line lands here with the reason it fired.",
    logOnlyLine: "The current line is still the only one in this session.",
    logLines: (n) => `${n} ${n === 1 ? "line" : "lines"}`,

    welcome:
      "Room Guide is starting. It scans ahead and speaks what it finds, and it never says the path is clear. Use the Start guide button, or press space, to pause or resume. D describes now. R repeats. One, two, or three sets detail. H repeats this help. If you use a screen reader, turn on screen reader mode in audio settings.",
    started: "Guide started. Scanning ahead.",
    guidePaused: "Guide paused.",
    guideReset: "Guide reset.",
    stale: (s) =>
      `The view is stale. Last scan was ${s} seconds ago. Treat what you hear as old.`,
    cameraOff: "Camera off. Using the synthetic feed.",
    cameraReady: "Camera ready. Point it ahead.",
    cameraUnavailable: "Camera unavailable. The synthetic feed keeps the pipeline explorable.",
    cameraDenied:
      "Camera access was denied. Allow it for this site in your browser settings, then try again.",
    cameraBusy: "The camera is in use by another app. Close it and try again.",
    cameraMissing: "No camera was found on this device.",
    cameraInsecure:
      "The camera needs a secure page. Open the HTTPS link, not a local network address.",
    syntheticNotice: "Synthetic scene, not your camera. Use my camera to scan your room.",
    nothingToRepeat: "Nothing to repeat yet.",
    narrationSpeechOn: "Automatic narration on.",
    narrationSpeechOff: "Automatic narration off. Describe, repeat, and help still speak.",
    detailSpoken: {
      critical: "Detail: critical only.",
      caution: "Detail: critical and caution.",
      all: "Detail: everything.",
    },
    speedSpoken: {
      slow: "Speech speed: slow.",
      normal: "Speech speed: normal.",
      fast: "Speech speed: fast.",
    },
    earconsOnSpeech: "Earcons on.",
    earconsOffSpeech: "Earcons off.",
    screenReaderOn:
      "Screen reader mode on. The guide stays silent and leaves speech to your screen reader.",
    screenReaderOff: "Screen reader mode off. The guide speaks again.",
    languageSpeech: (label) => `Language: ${label}. The guide will speak ${label}.`,
    degradedProxy:
      "Live mode is on but no sweep has completed. Is the proxy running on port 8787?",
    degradedTimeout: (s) =>
      `SAM 3.1 did not answer within ${s}s. Narration is paused — the geometry on screen is stale.`,
    degradedAborted: "The live sweep was cancelled. Narration is paused until a sweep completes.",
    degradedUnavailable: (reason) =>
      `Segmentation is unavailable (${reason}). Narration is paused rather than guessed.`,
    partialFailure: (labels) =>
      `No answer for ${labels} — those classes are untracked, not absent.`,

    summaryEmpty: "No tracked objects recognised. This does not mean the area is clear.",
    summaryHazards: (n) => `${n} hazard${n > 1 ? "s" : ""} in view.`,
    summaryNearest: (label) => `Nearest: ${label}.`,
    summaryNone: "none",

    aim: {
      on: "Aim coach on. Hold the phone upright and point it ahead. Higher ticks mean closer to level. The ticks stop when level.",
      off: "Aim coach off.",
      level: "Level. Hold still.",
      levelHold: "Level · hold still",
      holdUpright: "Hold the phone upright.",
      topUp: "Tilt the top up",
      topDown: "Tilt the top down",
      rightSide: "Lift the right side",
      leftSide: "Lift the left side",
      almost: "Almost level",
      noCamera: "Turn on the camera first, then aim coach.",
      noSensors: "This device does not report tilt. Aim coach needs a phone or tablet with motion sensors.",
      denied: "Motion access was denied. Aim coach needs motion access.",
      unavailable: "Motion access is unavailable. Aim coach needs motion access.",
      cameraOff: "Camera off. Aim coach stopped.",
      pitchRoll: (p, r) => `${p}° pitch · ${r}° roll`,
    },
  },

  es: {
    skipLink: "Saltar al contenido principal",
    navPrimary: "Principal",
    navGuide: "Guía en vivo",
    navFrame: "Fotograma",
    navQuality: "Calidad",
    footerTagline: "Geometría convertida en voz. La ausencia nunca se afirma.",

    asideLabel: "Narración y controles",
    standfirst: "Un escaneo periódico de lo que hay delante. Describe lo que ve y nunca afirma que el camino esté despejado.",
    tier: { critical: "Crítico", caution: "Precaución", informative: "Informativo" },
    corridorNote: "La línea discontinua marca el camino",
    legendAria: "Niveles de peligro",
    stageAria: "Vista segmentada de la escena",
    feedSynthetic: "Escena sintética",
    feedLive: "Cámara en vivo",

    start: "Iniciar guía",
    pause: "Pausar guía",
    describe: "Describir ahora",
    repeat: "Repetir",
    narrationOn: "Narración activa",
    narrationOff: "Narración desactivada",
    dockDescribe: "Describir",
    dockRepeat: "Repetir",
    dockNarrationOn: "Narración",
    dockNarrationOff: "Silenciada",
    useCamera: "Usar mi cámara",
    useSynthetic: "Usar escena sintética",
    aimCoach: "Guía de puntería",
    stopAiming: "Detener puntería",
    aimTitle: "Nivela el teléfono con tonos de orientación. Necesita la cámara y sensores de movimiento.",
    help: "Ayuda",
    resetSession: "Reiniciar sesión",
    close: "Cerrar",
    dismiss: "Descartar",

    voiceScanning: "Escaneando.",
    voiceStopped: "Detenido.",
    shortcutNote: "Espacio iniciar o pausar · D describir · R repetir · 1–3 detalle · S narración · A puntería · H ayuda",

    audioSettings: "Ajustes de audio",
    detailLabel: "Detalle",
    detailCriticalOption: "Solo crítico",
    detailCautionOption: "Crítico + precaución",
    detailAllOption: "Todo",
    speedLabel: "Velocidad de voz",
    speedSlowOption: "Lenta",
    speedNormalOption: "Normal",
    speedFastOption: "Rápida",
    languageLabel: "Idioma hablado",
    languageHint: "Usa la mejor voz instalada en su dispositivo para este idioma.",
    earconsLabel: "Avisos sonoros",
    earconsHint: "Pitidos de peligro, ping de escaneo y aviso de vista desactualizada.",
    screenReaderLabel: "Modo lector de pantalla",
    screenReaderHint: "Mantiene la guía en silencio y deja la voz a su lector de pantalla.",
    detailNote: "El detalle filtra lo que se habla, no lo que se detecta.",

    helpTitle: "Cómo usar Room Guide",
    helpLead:
      "Empiece con Espacio o el botón Iniciar guía. Room Guide escanea la vista cada pocos segundos y dice lo que encuentra. Describe lo que ve; nunca afirma que el camino esté despejado. Cada comando también tiene un botón.",
    helpKeys: [
      { keys: "Espacio", action: "Iniciar o pausar la guía" },
      { keys: "D", action: "Describir la vista actual" },
      { keys: "R", action: "Repetir el último anuncio" },
      { keys: "S", action: "Narración automática activada o desactivada" },
      { keys: "1 / 2 / 3", action: "Detalle: solo crítico · crítico + precaución · todo" },
      { keys: "A", action: "Guía de puntería: nivele el teléfono con tonos" },
      { keys: "H", action: "Abrir o cerrar esta ayuda" },
      { keys: "Esc", action: "Cerrar la ayuda o detener la guía" },
    ],
    helpNoteDetail:
      "El detalle filtra la narración, no la detección. Un peligro fuera del nivel elegido se sigue viendo y dibujando, simplemente no se habla. La narración automática se puede silenciar con S, pero los comandos explícitos y los avisos del sistema siguen respondiendo. Si usa un lector de pantalla, active el modo lector de pantalla en Ajustes de audio para que las dos voces no compitan.",
    helpNoteAim:
      "La guía de puntería necesita la cámara y un teléfono o tableta con sensores de movimiento; en iPhone pide acceso al movimiento. Los pitidos más agudos indican que está más cerca de nivel, y se detienen al nivelar. Nivel significa que el teléfono está nivelado, no que el camino esté despejado.",
    helpSpoken:
      "Room Guide. Espacio inicia o pausa. D describe la vista ahora. R repite el último anuncio. S activa o desactiva la narración automática. Uno, dos o tres ajusta el detalle: solo crítico, crítico y precaución, o todo. A inicia o detiene la guía de puntería. H abre o cierra esta ayuda. Escape cierra la ayuda o detiene la guía. Cada comando también tiene un botón. Avisos sonoros: un par ascendente significa inicio, un par descendente significa pausa, un pitido suave significa un escaneo nuevo, y un doble golpe grave significa que la vista está desactualizada. La guía de puntería necesita la cámara y un teléfono o tableta con sensores de movimiento. Nivel significa que el teléfono está nivelado, no que el camino esté despejado. La guía nunca dice que el camino esté despejado.",

    spokenNow: "Ahora",
    pausedNow: "En pausa",
    lineCount: (n) => `${n} ${n === 1 ? "línea" : "líneas"}`,
    listening: "Escuchando. Nada nuevo que anunciar.",
    notRunning: "Detenido.",
    trigger: {
      new: "primera vez",
      approaching: "se acerca",
      reappeared: "ha vuelto",
      manual: "a petición",
    },
    logTitle: "Registro de narración",
    logEmpty: "Aún no hay narración. Inicie la guía y cada línea hablada aparecerá aquí con el motivo.",
    logOnlyLine: "La línea actual sigue siendo la única de esta sesión.",
    logLines: (n) => `${n} ${n === 1 ? "línea" : "líneas"}`,

    welcome:
      "Room Guide se está iniciando. Escanea lo que hay delante y dice lo que encuentra, y nunca afirma que el camino esté despejado. Use el botón Iniciar guía, o pulse espacio, para pausar o reanudar. D describe ahora. R repite. Uno, dos o tres ajusta el detalle. H repite esta ayuda. Si usa un lector de pantalla, active el modo lector de pantalla en los ajustes de audio.",
    started: "Guía iniciada. Escaneando delante.",
    guidePaused: "Guía en pausa.",
    guideReset: "Guía reiniciada.",
    stale: (s) =>
      `La vista está desactualizada. El último escaneo fue hace ${s} segundos. Trate lo que oye como antiguo.`,
    cameraOff: "Cámara desactivada. Usando la escena sintética.",
    cameraReady: "Cámara lista. Apúntela hacia delante.",
    cameraUnavailable: "Cámara no disponible. La escena sintética mantiene la guía explorable.",
    cameraDenied:
      "Se denegó el acceso a la cámara. Permítalo para este sitio en los ajustes del navegador y vuelva a intentarlo.",
    cameraBusy: "Otra aplicación está usando la cámara. Ciérrela y vuelva a intentarlo.",
    cameraMissing: "No se encontró ninguna cámara en este dispositivo.",
    cameraInsecure:
      "La cámara necesita una página segura. Abra el enlace HTTPS, no una dirección de red local.",
    syntheticNotice:
      "Escena sintética, no su cámara. Use Mi cámara para escanear su habitación.",
    nothingToRepeat: "Aún no hay nada que repetir.",
    narrationSpeechOn: "Narración automática activada.",
    narrationSpeechOff: "Narración automática desactivada. Describir, repetir y ayuda siguen hablando.",
    detailSpoken: {
      critical: "Detalle: solo crítico.",
      caution: "Detalle: crítico y precaución.",
      all: "Detalle: todo.",
    },
    speedSpoken: {
      slow: "Velocidad de voz: lenta.",
      normal: "Velocidad de voz: normal.",
      fast: "Velocidad de voz: rápida.",
    },
    earconsOnSpeech: "Avisos sonoros activados.",
    earconsOffSpeech: "Avisos sonoros desactivados.",
    screenReaderOn:
      "Modo lector de pantalla activado. La guía queda en silencio y deja la voz a su lector de pantalla.",
    screenReaderOff: "Modo lector de pantalla desactivado. La guía vuelve a hablar.",
    languageSpeech: (label) => `Idioma: ${label}. La guía hablará en ${label}.`,
    degradedProxy:
      "El modo en vivo está activo pero ningún barrido ha terminado. ¿Está el proxy en el puerto 8787?",
    degradedTimeout: (s) =>
      `SAM 3.1 no respondió en ${s} s. La narración está en pausa; la geometría en pantalla está desactualizada.`,
    degradedAborted: "El barrido en vivo se canceló. La narración está en pausa hasta que termine un barrido.",
    degradedUnavailable: (reason) =>
      `La segmentación no está disponible (${reason}). La narración se pausa en vez de adivinar.`,
    partialFailure: (labels) =>
      `Sin respuesta para ${labels}: esas clases no se rastrean, no significa que no estén.`,

    summaryEmpty: "No se reconoció ningún objeto rastreado. Esto no significa que el área esté despejada.",
    summaryHazards: (n) => `${n} ${n === 1 ? "peligro" : "peligros"} a la vista.`,
    summaryNearest: (label) => `Lo más cercano: ${label}.`,
    summaryNone: "nada",

    aim: {
      on: "Guía de puntería activada. Sostenga el teléfono erguido y apunte hacia delante. Los pitidos más agudos indican que está más cerca de nivel. Los pitidos se detienen al nivelar.",
      off: "Guía de puntería desactivada.",
      level: "Nivelado. Mantenga quieto.",
      levelHold: "Nivelado · mantenga quieto",
      holdUpright: "Sostenga el teléfono erguido.",
      topUp: "Incline la parte superior hacia arriba",
      topDown: "Incline la parte superior hacia abajo",
      rightSide: "Levante el lado derecho",
      leftSide: "Levante el lado izquierdo",
      almost: "Casi nivelado",
      noCamera: "Active la cámara primero y luego la guía de puntería.",
      noSensors: "Este dispositivo no informa la inclinación. La guía de puntería necesita un teléfono o tableta con sensores de movimiento.",
      denied: "Se denegó el acceso al movimiento. La guía de puntería necesita acceso al movimiento.",
      unavailable: "El acceso al movimiento no está disponible. La guía de puntería lo necesita.",
      cameraOff: "Cámara desactivada. Guía de puntería detenida.",
      pitchRoll: (p, r) => `${p}° inclinación · ${r}° balanceo`,
    },
  },

  fr: {
    skipLink: "Aller au contenu principal",
    navPrimary: "Principale",
    navGuide: "Guide en direct",
    navFrame: "Image fixe",
    navQuality: "Qualité",
    footerTagline: "La géométrie devient parole. L'absence n'est jamais affirmée.",

    asideLabel: "Narration et commandes",
    standfirst: "Une analyse périodique de ce qui est devant. Elle décrit ce qu'elle voit et n'affirme jamais que la voie est libre.",
    tier: { critical: "Critique", caution: "Prudence", informative: "Informatif" },
    corridorNote: "Le couloir en pointillés marque le chemin",
    legendAria: "Niveaux de danger",
    stageAria: "Vue segmentée de la scène",
    feedSynthetic: "Scène synthétique",
    feedLive: "Caméra en direct",

    start: "Démarrer le guide",
    pause: "Mettre en pause",
    describe: "Décrire",
    repeat: "Répéter",
    narrationOn: "Narration active",
    narrationOff: "Narration coupée",
    dockDescribe: "Décrire",
    dockRepeat: "Répéter",
    dockNarrationOn: "Narration",
    dockNarrationOff: "Coupée",
    useCamera: "Utiliser ma caméra",
    useSynthetic: "Scène synthétique",
    aimCoach: "Aide au cadrage",
    stopAiming: "Arrêter le cadrage",
    aimTitle: "Nivellez le téléphone avec des tonalités. Nécessite la caméra et des capteurs de mouvement.",
    help: "Aide",
    resetSession: "Réinitialiser",
    close: "Fermer",
    dismiss: "Ignorer",

    voiceScanning: "Analyse en cours.",
    voiceStopped: "Arrêté.",
    shortcutNote: "Espace démarrer ou pause · D décrire · R répéter · 1–3 détail · S narration · A cadrage · H aide",

    audioSettings: "Réglages audio",
    detailLabel: "Détail",
    detailCriticalOption: "Critique uniquement",
    detailCautionOption: "Critique + prudence",
    detailAllOption: "Tout",
    speedLabel: "Vitesse de parole",
    speedSlowOption: "Lente",
    speedNormalOption: "Normale",
    speedFastOption: "Rapide",
    languageLabel: "Langue parlée",
    languageHint: "Utilise la meilleure voix installée sur votre appareil pour cette langue.",
    earconsLabel: "Signaux sonores",
    earconsHint: "Bips de danger, ping d'analyse et alerte de vue périmée.",
    screenReaderLabel: "Mode lecteur d'écran",
    screenReaderHint: "Garde le guide silencieux et laisse la parole à votre lecteur d'écran.",
    detailNote: "Le détail filtre ce qui est dit, pas ce qui est détecté.",

    helpTitle: "Utiliser Room Guide",
    helpLead:
      "Commencez avec Espace ou le bouton Démarrer le guide. Room Guide analyse la vue toutes les quelques secondes et dit ce qu'il trouve. Il décrit ce qu'il voit ; il n'affirme jamais que la voie est libre. Chaque commande a aussi un bouton.",
    helpKeys: [
      { keys: "Espace", action: "Démarrer ou mettre en pause le guide" },
      { keys: "D", action: "Décrire la vue actuelle" },
      { keys: "R", action: "Répéter la dernière annonce" },
      { keys: "S", action: "Narration automatique activée ou coupée" },
      { keys: "1 / 2 / 3", action: "Détail : critique uniquement · critique + prudence · tout" },
      { keys: "A", action: "Aide au cadrage : niveler le téléphone avec des tonalités" },
      { keys: "H", action: "Ouvrir ou fermer cette aide" },
      { keys: "Échap", action: "Fermer l'aide ou arrêter le guide" },
    ],
    helpNoteDetail:
      "Le détail filtre la narration, pas la détection. Un danger hors du niveau choisi reste vu et dessiné, il n'est simplement pas dit. La narration automatique peut être coupée avec S, mais les commandes explicites et les avertissements système répondent toujours. Si vous utilisez un lecteur d'écran, activez le mode lecteur d'écran dans les réglages audio pour que les deux voix ne se superposent pas.",
    helpNoteAim:
      "L'aide au cadrage nécessite la caméra et un téléphone ou une tablette avec capteurs de mouvement ; sur iPhone, elle demande l'accès au mouvement. Plus les bips sont aigus, plus vous êtes proche du niveau, et ils s'arrêtent au niveau. Niveau signifie que le téléphone est de niveau, pas que la voie est libre.",
    helpSpoken:
      "Room Guide. Espace démarre ou met en pause. D décrit la vue actuelle. R répète la dernière annonce. S active ou coupe la narration automatique. Un, deux ou trois règle le détail : critique uniquement, critique et prudence, ou tout. A démarre ou arrête l'aide au cadrage. H ouvre ou ferme cette aide. Échap ferme l'aide ou arrête le guide. Chaque commande a aussi un bouton. Signaux sonores : une paire montante signifie le démarrage, une paire descendante la pause, un ping doux une nouvelle analyse, et un double son grave une vue périmée. L'aide au cadrage nécessite la caméra et un téléphone ou une tablette avec capteurs de mouvement. Niveau signifie que le téléphone est de niveau, pas que la voie est libre. Le guide ne dit jamais que la voie est libre.",

    spokenNow: "Maintenant",
    pausedNow: "En pause",
    lineCount: (n) => `${n} ${n === 1 ? "ligne" : "lignes"}`,
    listening: "À l'écoute. Rien de nouveau à signaler.",
    notRunning: "Arrêté.",
    trigger: {
      new: "première fois",
      approaching: "se rapproche",
      reappeared: "revenu",
      manual: "sur demande",
    },
    logTitle: "Journal de narration",
    logEmpty: "Pas encore de narration. Démarrez le guide et chaque phrase apparaîtra ici avec sa raison.",
    logOnlyLine: "La ligne actuelle reste la seule de cette session.",
    logLines: (n) => `${n} ${n === 1 ? "ligne" : "lignes"}`,

    welcome:
      "Room Guide démarre. Il analyse ce qui est devant et annonce ce qu'il trouve, sans jamais affirmer que la voie est libre. Utilisez le bouton Démarrer le guide, ou la barre d'espace, pour mettre en pause ou reprendre. D décrit maintenant. R répète. Un, deux ou trois règle le détail. H répète cette aide. Si vous utilisez un lecteur d'écran, activez le mode lecteur d'écran dans les réglages audio.",
    started: "Guide démarré. Analyse devant vous.",
    guidePaused: "Guide en pause.",
    guideReset: "Guide réinitialisé.",
    stale: (s) =>
      `La vue est périmée. La dernière analyse date de ${s} secondes. Considérez ce que vous entendez comme ancien.`,
    cameraOff: "Caméra désactivée. Scène synthétique utilisée.",
    cameraReady: "Caméra prête. Dirigez-la devant vous.",
    cameraUnavailable: "Caméra indisponible. La scène synthétique permet de continuer à explorer.",
    cameraDenied:
      "L'accès à la caméra a été refusé. Autorisez-le pour ce site dans les réglages du navigateur, puis réessayez.",
    cameraBusy: "La caméra est utilisée par une autre application. Fermez-la et réessayez.",
    cameraMissing: "Aucune caméra n'a été trouvée sur cet appareil.",
    cameraInsecure:
      "La caméra nécessite une page sécurisée. Ouvrez le lien HTTPS, pas une adresse de réseau local.",
    syntheticNotice:
      "Scène synthétique, pas votre caméra. Utilisez Ma caméra pour analyser votre pièce.",
    nothingToRepeat: "Rien à répéter pour le moment.",
    narrationSpeechOn: "Narration automatique activée.",
    narrationSpeechOff: "Narration automatique coupée. Décrire, répéter et l'aide parlent toujours.",
    detailSpoken: {
      critical: "Détail : critique uniquement.",
      caution: "Détail : critique et prudence.",
      all: "Détail : tout.",
    },
    speedSpoken: {
      slow: "Vitesse de parole : lente.",
      normal: "Vitesse de parole : normale.",
      fast: "Vitesse de parole : rapide.",
    },
    earconsOnSpeech: "Signaux sonores activés.",
    earconsOffSpeech: "Signaux sonores désactivés.",
    screenReaderOn:
      "Mode lecteur d'écran activé. Le guide reste silencieux et laisse la parole à votre lecteur d'écran.",
    screenReaderOff: "Mode lecteur d'écran désactivé. Le guide parle de nouveau.",
    languageSpeech: (label) => `Langue : ${label}. Le guide parlera en ${label}.`,
    degradedProxy:
      "Le mode direct est actif mais aucune analyse n'est terminée. Le proxy tourne-t-il sur le port 8787 ?",
    degradedTimeout: (s) =>
      `SAM 3.1 n'a pas répondu en ${s} s. La narration est en pause ; la géométrie affichée est périmée.`,
    degradedAborted: "L'analyse en direct a été annulée. La narration est en pause jusqu'à la prochaine analyse.",
    degradedUnavailable: (reason) =>
      `La segmentation est indisponible (${reason}). La narration est mise en pause plutôt que devinée.`,
    partialFailure: (labels) =>
      `Pas de réponse pour ${labels} — ces classes ne sont pas suivies, pas absentes.`,

    summaryEmpty: "Aucun objet suivi reconnu. Cela ne signifie pas que la zone est libre.",
    summaryHazards: (n) => `${n} danger${n > 1 ? "s" : ""} en vue.`,
    summaryNearest: (label) => `Le plus proche : ${label}.`,
    summaryNone: "rien",

    aim: {
      on: "Aide au cadrage activée. Tenez le téléphone droit et dirigez-le devant vous. Plus les bips sont aigus, plus vous êtes proche du niveau. Ils s'arrêtent au niveau.",
      off: "Aide au cadrage arrêtée.",
      level: "De niveau. Restez immobile.",
      levelHold: "De niveau · restez immobile",
      holdUpright: "Tenez le téléphone droit.",
      topUp: "Relevez le haut",
      topDown: "Abaissez le haut",
      rightSide: "Levez le côté droit",
      leftSide: "Levez le côté gauche",
      almost: "Presque de niveau",
      noCamera: "Activez d'abord la caméra, puis l'aide au cadrage.",
      noSensors: "Cet appareil n'indique pas l'inclinaison. L'aide au cadrage nécessite un téléphone ou une tablette avec capteurs de mouvement.",
      denied: "L'accès au mouvement a été refusé. L'aide au cadrage en a besoin.",
      unavailable: "L'accès au mouvement est indisponible. L'aide au cadrage en a besoin.",
      cameraOff: "Caméra désactivée. Aide au cadrage arrêtée.",
      pitchRoll: (p, r) => `${p}° inclinaison · ${r}° roulis`,
    },
  },

  pt: {
    skipLink: "Ir para o conteúdo principal",
    navPrimary: "Principal",
    navGuide: "Guia ao vivo",
    navFrame: "Quadro único",
    navQuality: "Qualidade",
    footerTagline: "Geometria transformada em fala. A ausência nunca é afirmada.",

    asideLabel: "Narração e controles",
    standfirst: "Uma varredura periódica do que está à frente. Descreve o que vê e nunca afirma que o caminho está livre.",
    tier: { critical: "Crítico", caution: "Atenção", informative: "Informativo" },
    corridorNote: "A linha tracejada marca o caminho",
    legendAria: "Níveis de perigo",
    stageAria: "Vista segmentada da cena",
    feedSynthetic: "Cena sintética",
    feedLive: "Câmera ao vivo",

    start: "Iniciar guia",
    pause: "Pausar guia",
    describe: "Descrever agora",
    repeat: "Repetir",
    narrationOn: "Narração ativa",
    narrationOff: "Narração desligada",
    dockDescribe: "Descrever",
    dockRepeat: "Repetir",
    dockNarrationOn: "Narração",
    dockNarrationOff: "Desligada",
    useCamera: "Usar minha câmera",
    useSynthetic: "Usar cena sintética",
    aimCoach: "Guia de mira",
    stopAiming: "Parar mira",
    aimTitle: "Nivele o celular com tons de orientação. Precisa da câmera e de sensores de movimento.",
    help: "Ajuda",
    resetSession: "Reiniciar sessão",
    close: "Fechar",
    dismiss: "Dispensar",

    voiceScanning: "Examinando.",
    voiceStopped: "Parado.",
    shortcutNote: "Espaço iniciar ou pausar · D descrever · R repetir · 1–3 detalhe · S narração · A mira · H ajuda",

    audioSettings: "Ajustes de áudio",
    detailLabel: "Detalhe",
    detailCriticalOption: "Somente crítico",
    detailCautionOption: "Crítico + atenção",
    detailAllOption: "Tudo",
    speedLabel: "Velocidade da fala",
    speedSlowOption: "Lenta",
    speedNormalOption: "Normal",
    speedFastOption: "Rápida",
    languageLabel: "Idioma falado",
    languageHint: "Usa a melhor voz instalada no seu dispositivo para este idioma.",
    earconsLabel: "Sinais sonoros",
    earconsHint: "Bipes de perigo, ping de varredura e aviso de vista desatualizada.",
    screenReaderLabel: "Modo leitor de tela",
    screenReaderHint: "Mantém o guia em silêncio e deixa a fala com seu leitor de tela.",
    detailNote: "O detalhe filtra o que é falado, não o que é detectado.",

    helpTitle: "Como usar o Room Guide",
    helpLead:
      "Comece com Espaço ou o botão Iniciar guia. O Room Guide examina a vista a cada poucos segundos e diz o que encontra. Descreve o que vê; nunca afirma que o caminho está livre. Cada comando também tem um botão.",
    helpKeys: [
      { keys: "Espaço", action: "Iniciar ou pausar o guia" },
      { keys: "D", action: "Descrever a vista atual" },
      { keys: "R", action: "Repetir o último anúncio" },
      { keys: "S", action: "Narração automática ligada ou desligada" },
      { keys: "1 / 2 / 3", action: "Detalhe: somente crítico · crítico + atenção · tudo" },
      { keys: "A", action: "Guia de mira: nivelar o celular com tons" },
      { keys: "H", action: "Abrir ou fechar esta ajuda" },
      { keys: "Esc", action: "Fechar a ajuda ou parar o guia" },
    ],
    helpNoteDetail:
      "O detalhe filtra a narração, não a detecção. Um perigo fora do nível escolhido continua sendo visto e desenhado, apenas não é falado. A narração automática pode ser silenciada com S, mas os comandos explícitos e os avisos do sistema continuam respondendo. Se usa um leitor de tela, ative o modo leitor de tela nos ajustes de áudio para que as duas vozes não compitam.",
    helpNoteAim:
      "O guia de mira precisa da câmera e de um celular ou tablet com sensores de movimento; no iPhone, pede acesso ao movimento. Bipes mais agudos indicam que está mais perto de nivelado, e param quando nivelar. Nivelado significa que o celular está nivelado, não que o caminho está livre.",
    helpSpoken:
      "Room Guide. Espaço inicia ou pausa. D descreve a vista agora. R repete o último anúncio. S liga ou desliga a narração automática. Um, dois ou três ajusta o detalhe: somente crítico, crítico e atenção, ou tudo. A inicia ou para o guia de mira. H abre ou fecha esta ajuda. Esc fecha a ajuda ou para o guia. Cada comando também tem um botão. Sinais sonoros: um par ascendente significa início, um par descendente pausa, um ping suave uma nova varredura, e um som grave duplo uma vista desatualizada. O guia de mira precisa da câmera e de um celular ou tablet com sensores de movimento. Nivelado significa que o celular está nivelado, não que o caminho está livre. O guia nunca diz que o caminho está livre.",

    spokenNow: "Agora",
    pausedNow: "Pausado",
    lineCount: (n) => `${n} ${n === 1 ? "linha" : "linhas"}`,
    listening: "Ouvindo. Nada novo para relatar.",
    notRunning: "Parado.",
    trigger: {
      new: "primeira vez",
      approaching: "se aproxima",
      reappeared: "voltou",
      manual: "a pedido",
    },
    logTitle: "Registro de narração",
    logEmpty: "Ainda não há narração. Inicie o guia e cada linha falada aparecerá aqui com o motivo.",
    logOnlyLine: "A linha atual ainda é a única desta sessão.",
    logLines: (n) => `${n} ${n === 1 ? "linha" : "linhas"}`,

    welcome:
      "O Room Guide está iniciando. Examina o que está à frente e diz o que encontra, e nunca afirma que o caminho está livre. Use o botão Iniciar guia, ou pressione espaço, para pausar ou retomar. D descreve agora. R repete. Um, dois ou três ajusta o detalhe. H repete esta ajuda. Se usa um leitor de tela, ative o modo leitor de tela nos ajustes de áudio.",
    started: "Guia iniciado. Examinando à frente.",
    guidePaused: "Guia pausado.",
    guideReset: "Guia reiniciado.",
    stale: (s) =>
      `A vista está desatualizada. A última varredura foi há ${s} segundos. Trate o que ouve como antigo.`,
    cameraOff: "Câmera desligada. Usando a cena sintética.",
    cameraReady: "Câmera pronta. Aponte para a frente.",
    cameraUnavailable: "Câmera indisponível. A cena sintética mantém o guia explorável.",
    cameraDenied:
      "O acesso à câmara foi negado. Permita-o para este site nas definições do navegador e tente novamente.",
    cameraBusy: "A câmara está a ser usada por outra aplicação. Feche-a e tente novamente.",
    cameraMissing: "Não foi encontrada nenhuma câmara neste dispositivo.",
    cameraInsecure:
      "A câmara precisa de uma página segura. Abra a ligação HTTPS, não um endereço de rede local.",
    syntheticNotice:
      "Cena sintética, não a sua câmara. Use A minha câmara para analisar a sua sala.",
    nothingToRepeat: "Ainda não há nada para repetir.",
    narrationSpeechOn: "Narração automática ativada.",
    narrationSpeechOff: "Narração automática desligada. Descrever, repetir e ajuda ainda falam.",
    detailSpoken: {
      critical: "Detalhe: somente crítico.",
      caution: "Detalhe: crítico e atenção.",
      all: "Detalhe: tudo.",
    },
    speedSpoken: {
      slow: "Velocidade da fala: lenta.",
      normal: "Velocidade da fala: normal.",
      fast: "Velocidade da fala: rápida.",
    },
    earconsOnSpeech: "Sinais sonoros ativados.",
    earconsOffSpeech: "Sinais sonoros desativados.",
    screenReaderOn:
      "Modo leitor de tela ativado. O guia fica em silêncio e deixa a fala com o leitor de tela.",
    screenReaderOff: "Modo leitor de tela desativado. O guia fala novamente.",
    languageSpeech: (label) => `Idioma: ${label}. O guia falará em ${label}.`,
    degradedProxy:
      "O modo ao vivo está ativo, mas nenhuma varredura terminou. O proxy está rodando na porta 8787?",
    degradedTimeout: (s) =>
      `SAM 3.1 não respondeu em ${s} s. A narração está pausada; a geometria na tela está desatualizada.`,
    degradedAborted: "A varredura ao vivo foi cancelada. A narração fica pausada até uma varredura terminar.",
    degradedUnavailable: (reason) =>
      `A segmentação está indisponível (${reason}). A narração pausa em vez de adivinhar.`,
    partialFailure: (labels) =>
      `Sem resposta para ${labels} — essas classes não são rastreadas, não estão ausentes.`,

    summaryEmpty: "Nenhum objeto rastreado reconhecido. Isso não significa que a área esteja livre.",
    summaryHazards: (n) => `${n} ${n === 1 ? "perigo" : "perigos"} à vista.`,
    summaryNearest: (label) => `O mais próximo: ${label}.`,
    summaryNone: "nada",

    aim: {
      on: "Guia de mira ativado. Segure o celular em pé e aponte para a frente. Bipes mais agudos indicam que está mais perto de nivelado. Os bipes param ao nivelar.",
      off: "Guia de mira desativado.",
      level: "Nivelado. Fique imóvel.",
      levelHold: "Nivelado · fique imóvel",
      holdUpright: "Segure o celular em pé.",
      topUp: "Incline a parte de cima para cima",
      topDown: "Incline a parte de cima para baixo",
      rightSide: "Levante o lado direito",
      leftSide: "Levante o lado esquerdo",
      almost: "Quase nivelado",
      noCamera: "Ligue a câmera primeiro, depois o guia de mira.",
      noSensors: "Este dispositivo não informa inclinação. O guia de mira precisa de um celular ou tablet com sensores de movimento.",
      denied: "O acesso ao movimento foi negado. O guia de mira precisa desse acesso.",
      unavailable: "O acesso ao movimento não está disponível. O guia de mira precisa dele.",
      cameraOff: "Câmera desligada. Guia de mira parado.",
      pitchRoll: (p, r) => `${p}° inclinação · ${r}° rolagem`,
    },
  },

  de: {
    skipLink: "Zum Hauptinhalt springen",
    navPrimary: "Hauptnavigation",
    navGuide: "Live-Guide",
    navFrame: "Einzelbild",
    navQuality: "Qualität",
    footerTagline: "Geometrie wird Sprache. Abwesenheit wird nie behauptet.",

    asideLabel: "Erzählung und Steuerung",
    standfirst: "Ein regelmäßiger Scan dessen, was vor Ihnen liegt. Er beschreibt, was er sieht, und behauptet nie, dass der Weg frei ist.",
    tier: { critical: "Kritisch", caution: "Vorsicht", informative: "Informativ" },
    corridorNote: "Die gestrichelte Linie markiert den Weg",
    legendAria: "Gefahrenstufen",
    stageAria: "Segmentierte Ansicht der Szene",
    feedSynthetic: "Synthetische Szene",
    feedLive: "Live-Kamera",

    start: "Guide starten",
    pause: "Guide pausieren",
    describe: "Jetzt beschreiben",
    repeat: "Wiederholen",
    narrationOn: "Erzählung an",
    narrationOff: "Erzählung aus",
    dockDescribe: "Beschreiben",
    dockRepeat: "Nochmal",
    dockNarrationOn: "Erzählung",
    dockNarrationOff: "Stumm",
    useCamera: "Eigene Kamera",
    useSynthetic: "Synthetische Szene",
    aimCoach: "Ausrichtungshilfe",
    stopAiming: "Ausrichtung beenden",
    aimTitle: "Das Telefon mit Orientierungstönen ausrichten. Benötigt Kamera und Bewegungssensoren.",
    help: "Hilfe",
    resetSession: "Sitzung zurücksetzen",
    close: "Schließen",
    dismiss: "Verwerfen",

    voiceScanning: "Scan läuft.",
    voiceStopped: "Angehalten.",
    shortcutNote: "Leertaste Start oder Pause · D beschreiben · R wiederholen · 1–3 Detail · S Erzählung · A Ausrichtung · H Hilfe",

    audioSettings: "Audioeinstellungen",
    detailLabel: "Detail",
    detailCriticalOption: "Nur kritisch",
    detailCautionOption: "Kritisch + Vorsicht",
    detailAllOption: "Alles",
    speedLabel: "Sprechgeschwindigkeit",
    speedSlowOption: "Langsam",
    speedNormalOption: "Normal",
    speedFastOption: "Schnell",
    languageLabel: "Gesprochene Sprache",
    languageHint: "Verwendet die beste installierte Stimme für diese Sprache auf Ihrem Gerät.",
    earconsLabel: "Signalton",
    earconsHint: "Gefahrensignale, Scan-Ping und Hinweis auf veraltete Ansicht.",
    screenReaderLabel: "Screenreader-Modus",
    screenReaderHint: "Hält den Guide still und überlässt das Sprechen Ihrem Screenreader.",
    detailNote: "Detail filtert, was gesprochen wird, nicht was erkannt wird.",

    helpTitle: "Room Guide verwenden",
    helpLead:
      "Starten Sie mit der Leertaste oder der Schaltfläche Guide starten. Room Guide scannt die Ansicht alle paar Sekunden und sagt, was er findet. Er beschreibt, was er sieht; er behauptet nie, dass der Weg frei ist. Jeder Befehl hat auch eine Schaltfläche.",
    helpKeys: [
      { keys: "Leertaste", action: "Guide starten oder pausieren" },
      { keys: "D", action: "Aktuelle Ansicht beschreiben" },
      { keys: "R", action: "Letzte Ansage wiederholen" },
      { keys: "S", action: "Automatische Erzählung an oder aus" },
      { keys: "1 / 2 / 3", action: "Detail: nur kritisch · kritisch + Vorsicht · alles" },
      { keys: "A", action: "Ausrichtungshilfe: Telefon mit Tönen ausrichten" },
      { keys: "H", action: "Diese Hilfe öffnen oder schließen" },
      { keys: "Esc", action: "Hilfe schließen oder Guide anhalten" },
    ],
    helpNoteDetail:
      "Detail filtert die Erzählung, nicht die Erkennung. Eine Gefahr außerhalb der gewählten Stufe wird weiterhin gesehen und gezeichnet, aber nicht gesprochen. Die automatische Erzählung lässt sich mit S stummschalten, ausdrückliche Befehle und Systemwarnungen antworten weiterhin. Wenn Sie einen Screenreader verwenden, aktivieren Sie den Screenreader-Modus in den Audioeinstellungen, damit die beiden Stimmen nicht konkurrieren.",
    helpNoteAim:
      "Die Ausrichtungshilfe benötigt die Kamera und ein Telefon oder Tablet mit Bewegungssensoren; auf dem iPhone fragt sie nach Bewegungszugriff. Höhere Töne bedeuten näher an der Waagerechten, und bei Waagerechte hören die Töne auf. Waagerecht bedeutet, dass das Telefon waagerecht ist – nicht, dass der Weg frei ist.",
    helpSpoken:
      "Room Guide. Leertaste startet oder pausiert. D beschreibt die aktuelle Ansicht. R wiederholt die letzte Ansage. S schaltet die automatische Erzählung ein oder aus. Eins, zwei oder drei stellt den Detailgrad ein: nur kritisch, kritisch und Vorsicht, oder alles. A startet oder beendet die Ausrichtungshilfe. H öffnet oder schließt diese Hilfe. Escape schließt die Hilfe oder hält den Guide an. Jeder Befehl hat auch eine Schaltfläche. Signaltöne: ein aufsteigendes Paar bedeutet Start, ein absteigendes Paar Pause, ein leiser Ping einen neuen Scan und ein tiefer Doppelton eine veraltete Ansicht. Die Ausrichtungshilfe benötigt die Kamera und ein Telefon oder Tablet mit Bewegungssensoren. Waagerecht bedeutet, dass das Telefon waagerecht ist, nicht dass der Weg frei ist. Der Guide sagt nie, dass der Weg frei ist.",

    spokenNow: "Jetzt",
    pausedNow: "Pausiert",
    lineCount: (n) => `${n} ${n === 1 ? "Zeile" : "Zeilen"}`,
    listening: "Ich höre zu. Nichts Neues zu melden.",
    notRunning: "Angehalten.",
    trigger: {
      new: "neu gesehen",
      approaching: "kommt näher",
      reappeared: "wieder da",
      manual: "auf Anfrage",
    },
    logTitle: "Erzählprotokoll",
    logEmpty: "Noch keine Erzählung. Starten Sie den Guide; jede gesprochene Zeile erscheint hier mit ihrem Grund.",
    logOnlyLine: "Die aktuelle Zeile ist weiterhin die einzige in dieser Sitzung.",
    logLines: (n) => `${n} ${n === 1 ? "Zeile" : "Zeilen"}`,

    welcome:
      "Room Guide startet. Es prüft, was vor Ihnen liegt, und sagt, was es findet. Es behauptet nie, dass der Weg frei ist. Mit der Schaltfläche Guide starten oder der Leertaste pausieren oder fortsetzen. D beschreibt jetzt. R wiederholt. Eins, zwei oder drei stellt den Detailgrad ein. H wiederholt diese Hilfe. Wenn Sie einen Screenreader verwenden, aktivieren Sie den Screenreader-Modus in den Audioeinstellungen.",
    started: "Guide gestartet. Ich prüfe, was vor Ihnen liegt.",
    guidePaused: "Guide pausiert.",
    guideReset: "Guide zurückgesetzt.",
    stale: (s) =>
      `Die Ansicht ist veraltet. Der letzte Scan war vor ${s} Sekunden. Behandeln Sie das Gehörte als alt.`,
    cameraOff: "Kamera aus. Die synthetische Szene wird verwendet.",
    cameraReady: "Kamera bereit. Richten Sie sie nach vorn.",
    cameraUnavailable: "Kamera nicht verfügbar. Die synthetische Szene bleibt zum Erkunden verfügbar.",
    cameraDenied:
      "Kamerazugriff wurde abgelehnt. Erlauben Sie ihn für diese Seite in den Browsereinstellungen und versuchen Sie es erneut.",
    cameraBusy: "Die Kamera wird von einer anderen App verwendet. Schließen Sie sie und versuchen Sie es erneut.",
    cameraMissing: "Auf diesem Gerät wurde keine Kamera gefunden.",
    cameraInsecure:
      "Die Kamera benötigt eine sichere Seite. Öffnen Sie den HTTPS-Link, keine lokale Netzwerkadresse.",
    syntheticNotice:
      "Synthetische Szene, nicht Ihre Kamera. Verwenden Sie Meine Kamera, um Ihren Raum zu erfassen.",
    nothingToRepeat: "Es gibt noch nichts zu wiederholen.",
    narrationSpeechOn: "Automatische Erzählung an.",
    narrationSpeechOff: "Automatische Erzählung aus. Beschreiben, Wiederholen und Hilfe sprechen weiterhin.",
    detailSpoken: {
      critical: "Detail: nur kritisch.",
      caution: "Detail: kritisch und Vorsicht.",
      all: "Detail: alles.",
    },
    speedSpoken: {
      slow: "Sprechgeschwindigkeit: langsam.",
      normal: "Sprechgeschwindigkeit: normal.",
      fast: "Sprechgeschwindigkeit: schnell.",
    },
    earconsOnSpeech: "Signalton an.",
    earconsOffSpeech: "Signalton aus.",
    screenReaderOn:
      "Screenreader-Modus an. Der Guide bleibt still und überlässt das Sprechen Ihrem Screenreader.",
    screenReaderOff: "Screenreader-Modus aus. Der Guide spricht wieder.",
    languageSpeech: (label) => `Sprache: ${label}. Der Guide spricht ${label}.`,
    degradedProxy:
      "Der Live-Modus ist an, aber kein Scan wurde abgeschlossen. Läuft der Proxy auf Port 8787?",
    degradedTimeout: (s) =>
      `SAM 3.1 hat nicht innerhalb von ${s} s geantwortet. Die Erzählung ist pausiert – die Geometrie auf dem Bildschirm ist veraltet.`,
    degradedAborted: "Der Live-Scan wurde abgebrochen. Die Erzählung pausiert, bis ein Scan abgeschlossen ist.",
    degradedUnavailable: (reason) =>
      `Segmentierung ist nicht verfügbar (${reason}). Die Erzählung pausiert, statt zu raten.`,
    partialFailure: (labels) =>
      `Keine Antwort für ${labels} – diese Klassen werden nicht verfolgt, nicht als abwesend bestätigt.`,

    summaryEmpty: "Keine verfolgten Objekte erkannt. Das bedeutet nicht, dass der Bereich frei ist.",
    summaryHazards: (n) => `${n} ${n === 1 ? "Gefahr" : "Gefahren"} im Blick.`,
    summaryNearest: (label) => `Am nächsten: ${label}.`,
    summaryNone: "nichts",

    aim: {
      on: "Ausrichtungshilfe an. Halten Sie das Telefon aufrecht und richten Sie es nach vorn. Höhere Töne bedeuten näher an der Waagerechten. Bei Waagerechte hören die Töne auf.",
      off: "Ausrichtungshilfe aus.",
      level: "Waagerecht. Halten Sie still.",
      levelHold: "Waagerecht · halten Sie still",
      holdUpright: "Halten Sie das Telefon aufrecht.",
      topUp: "Oberkante anheben",
      topDown: "Oberkante absenken",
      rightSide: "Rechte Seite anheben",
      leftSide: "Linke Seite anheben",
      almost: "Fast waagerecht",
      noCamera: "Schalten Sie zuerst die Kamera ein, dann die Ausrichtungshilfe.",
      noSensors: "Dieses Gerät meldet keine Neigung. Die Ausrichtungshilfe benötigt ein Telefon oder Tablet mit Bewegungssensoren.",
      denied: "Der Bewegungszugriff wurde verweigert. Die Ausrichtungshilfe benötigt ihn.",
      unavailable: "Der Bewegungszugriff ist nicht verfügbar. Die Ausrichtungshilfe benötigt ihn.",
      cameraOff: "Kamera aus. Ausrichtungshilfe beendet.",
      pitchRoll: (p, r) => `${p}° Neigung · ${r}° Roll`,
    },
  },
};

export function localeSpec(locale: Locale): LocaleSpec {
  return LOCALES.find((l) => l.id === locale) ?? LOCALES[0]!;
}
