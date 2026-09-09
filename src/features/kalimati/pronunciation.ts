/* Pronunciation assessment: speech recognition + phonetic/string similarity
   + simple audio duration checks. All of it runs in the browser. */

export type Grade = "Excellent" | "Very Good" | "Good" | "Keep Practicing";

export type Score = {
  percent: number;
  grade: Grade;
  stars: number;
  heard: string;
  expected: string;
  parts: Array<{ text: string; ok: boolean }>;
  tips: string[];
  durationMs: number;
  recognised: boolean;
};

/* ---------- text normalising ---------- */

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normaliseAr(s: string): string {
  return (s || "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064A\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliseEn(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalise = (s: string, lang: "en" | "ar") => (lang === "ar" ? normaliseAr(s) : normaliseEn(s));

/* ---------- similarity ---------- */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  return 1 - levenshtein(a, b) / longest;
}

/* an English "sounds like" key so cat/kat/khat score close together */
function soundKey(s: string): string {
  return s
    .replace(/ph/g, "f")
    .replace(/ck|q|kh/g, "k")
    .replace(/sh|ch/g, "s")
    .replace(/th|dh/g, "t")
    .replace(/[aeiou]+/g, "a")
    .replace(/(.)\1+/g, "$1");
}

/* ---------- per-letter / per-syllable breakdown ---------- */

function breakdown(expected: string, heard: string, lang: "en" | "ar") {
  const units = lang === "ar" ? expected.split("") : chunkSyllables(expected);
  const pool = heard.split("");
  return units.map((text) => {
    const letters = text.split("");
    const ok = letters.every((ch) => {
      const at = pool.indexOf(ch);
      if (at < 0) return false;
      pool.splice(at, 1);
      return true;
    });
    return { text, ok };
  });
}

function chunkSyllables(word: string): string[] {
  const out = word.match(/[^aeiou]*[aeiou]+(?:[^aeiou](?![aeiou]))?/gi);
  return out && out.length ? out : [word];
}

/* ---------- grading ---------- */

function gradeFor(percent: number): { grade: Grade; stars: number } {
  if (percent >= 90) return { grade: "Excellent", stars: 3 };
  if (percent >= 75) return { grade: "Very Good", stars: 3 };
  if (percent >= 55) return { grade: "Good", stars: 2 };
  return { grade: "Keep Practicing", stars: 1 };
}

export const scoreColour = (percent: number) =>
  percent >= 90 ? "#BCE8D3" : percent >= 75 ? "#DFF3EA" : percent >= 55 ? "#FFE9CC" : "#FFC9B8";

/* ---------- the assessment ---------- */

export function assess(args: {
  expectedRaw: string;
  heardRaw: string;
  lang: "en" | "ar";
  durationMs: number;
  recognised: boolean;
}): Score {
  const { lang, durationMs, recognised } = args;
  const expected = normalise(args.expectedRaw, lang);
  const heard = normalise(args.heardRaw, lang);

  let percent: number;
  const tips: string[] = [];

  if (recognised && heard) {
    const exact = similarity(expected, heard);
    const sounds = lang === "en" ? similarity(soundKey(expected), soundKey(heard)) : exact;
    percent = Math.round(Math.max(exact, sounds * 0.95) * 100);

    if (heard === expected) tips.push("Word for word — that is exactly it.");
    if (percent < 90 && heard !== expected) tips.push(`I heard "${args.heardRaw.trim()}" — try it once more, slowly.`);
    if (expected.length > heard.length + 1) tips.push("The ending sounded cut short — hold the last sound a little longer.");
    if (heard.length > expected.length + 1) tips.push("There was an extra sound at the end — stop as soon as the word finishes.");
    if (lang === "ar" && percent < 75) tips.push("Listen to the model voice, then copy it straight away — Arabic letters like ع, ح and ق come from deeper in the throat.");
  } else {
    // no recognition available (or nothing understood) — fall back to the audio itself
    percent = durationMs >= 350 && durationMs <= 3000 ? 60 : 40;
    tips.push("I could not check the sounds this time, so this is a rough guess from the recording itself.");
  }

  if (durationMs && durationMs < 350) {
    percent = Math.max(20, percent - 20);
    tips.push("That was very quick — start speaking just after you tap the red dot.");
  } else if (durationMs > 4000) {
    percent = Math.max(20, percent - 10);
    tips.push("Long recording — say just the one word, then tap stop.");
  }

  percent = Math.max(0, Math.min(100, percent));
  const { grade, stars } = gradeFor(percent);
  if (!tips.length) tips.push("Lovely and clear. Try the next word!");

  return {
    percent,
    grade,
    stars,
    heard: args.heardRaw.trim(),
    expected: args.expectedRaw,
    parts: breakdown(expected, heard, lang),
    tips: tips.slice(0, 3),
    durationMs,
    recognised: recognised && !!heard,
  };
}

/* ---------- speech recognition ---------- */

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function recognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w["SpeechRecognition"] || w["webkitSpeechRecognition"]);
}

/** Starts listening; returns a stop() that resolves with whatever was heard. */
export function listen(lang: "en" | "ar"): () => Promise<string> {
  if (!recognitionSupported()) return async () => "";
  const w = window as unknown as Record<string, new () => RecognitionLike>;
  const Ctor = w["SpeechRecognition"] || w["webkitSpeechRecognition"];
  if (!Ctor) return async () => "";
  let transcript = "";
  let settled: ((t: string) => void) | null = null;
  let ended = false;

  let rec: RecognitionLike;
  try {
    rec = new Ctor();
  } catch {
    return async () => "";
  }
  rec.lang = lang === "ar" ? "ar-SA" : "en-GB";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.onresult = (e) => {
    for (let i = 0; i < e.results.length; i++) {
      const alt = e.results[i]?.[0];
      if (alt && alt.transcript) transcript = alt.transcript;
    }
  };
  rec.onerror = () => {
    ended = true;
    settled?.(transcript);
  };
  rec.onend = () => {
    ended = true;
    settled?.(transcript);
  };
  try {
    rec.start();
  } catch {
    return async () => "";
  }

  return () =>
    new Promise<string>((res) => {
      if (ended) {
        res(transcript);
        return;
      }
      settled = res;
      try {
        rec.stop();
      } catch {
        res(transcript);
      }
      setTimeout(() => res(transcript), 1500);
    });
}
