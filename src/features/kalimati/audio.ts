import type { Word } from "@/data/decks";

/* ---------------- speech synthesis ---------------- */

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  try {
    const synth = window.speechSynthesis;
    const all = synth.getVoices() || [];
    const want = all.filter((v) => (v.lang || "").toLowerCase().indexOf(lang) === 0);
    if (!want.length) return null;

    const CHILD = ["child", "kid", "junior"];
    const BRIGHT = [
      "samantha", "karen", "tessa", "moira", "fiona", "serena", "allison", "ava",
      "susan", "zoe", "nicky", "joana", "female", "hala", "laila", "zaina", "salma", "amira",
    ];
    const AVOID = ["male", "daniel", "oliver", "alex", "fred", "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "deranged", "hysterical", "jester", "organ", "trinoids", "whisper", "wobble", "zarvox"];

    const score = (v: SpeechSynthesisVoice) => {
      const n = (v.name || "").toLowerCase();
      let sc = 0;
      if (AVOID.some((a) => n.indexOf(a) >= 0)) sc -= 40;
      if (CHILD.some((c) => n.indexOf(c) >= 0)) sc += 60;
      if (BRIGHT.some((b) => n.indexOf(b) >= 0)) sc += 25;
      if (v.localService) sc += 4;
      if (n.indexOf("google") >= 0) sc += 12;
      if (n.indexOf("natural") >= 0 || n.indexOf("premium") >= 0 || n.indexOf("enhanced") >= 0) sc += 10;
      return sc;
    };

    return want.slice().sort((a, b) => score(b) - score(a))[0];
  } catch {
    return null;
  }
}

const VOICE_PITCH = 1.35;

function utter(text: string, lang: string, rate: number) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const v = pickVoice(lang.slice(0, 2));
  if (v) u.voice = v;
  const isChild = v && /child|kid|junior/i.test(v.name || "");
  u.pitch = Math.max(0.5, Math.min(2, isChild ? Math.min(VOICE_PITCH, 1.1) : VOICE_PITCH));
  return u;
}

function whenVoicesReady(fn: () => void) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if ((synth.getVoices() || []).length) {
      fn();
      return;
    }
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      fn();
    };
    synth.addEventListener("voiceschanged", go, { once: true });
    setTimeout(go, 350);
  } catch {
    /* ignore */
  }
}

export function speakEn(text: string) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth || !text) return;
  whenVoicesReady(() => {
    try {
      synth.cancel();
      synth.speak(utter(text, "en-GB", 0.85));
    } catch {
      /* ignore */
    }
  });
}

export function speakAr(text: string) {
  if (!text) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    synth.speak(utter(text, "ar-SA", 0.75));
  } catch {
    /* ignore */
  }
}

export function speakBoth(en: string, ar: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    whenVoicesReady(() => {
      try {
        synth.cancel();
        synth.speak(utter(en, "en-GB", 0.85));
        if (ar) {
          const pause = new SpeechSynthesisUtterance(" ");
          pause.volume = 0;
          synth.speak(pause);
          synth.speak(utter(ar, "ar-SA", 0.75));
        }
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

/* ---------------- chimes ---------------- */

let ac: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ac = ac || new Ctx();
    return ac;
  } catch {
    return null;
  }
}

function tones(notes: Array<[number, number]>, type: OscillatorType, peak: number, tail: number) {
  const a = ctx();
  if (!a) return;
  notes.forEach(([f, t]) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    const at = a.currentTime + t;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + tail);
    o.connect(g);
    g.connect(a.destination);
    o.start(at);
    o.stop(at + tail + 0.04);
  });
}

export function chime(right: boolean) {
  tones(
    right
      ? [[784, 0], [988, 0.09], [1319, 0.18], [1568, 0.28]]
      : [[392, 0], [330, 0.12], [262, 0.24]],
    right ? "triangle" : "sine",
    0.16,
    0.2,
  );
}

export function fanfare() {
  tones([[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.5], [1047, 0.6]], "triangle", 0.18, 0.3);
}

/* ---------------- recorded voice clips (IndexedDB) ---------------- */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const open = (version?: number) =>
    new Promise<IDBDatabase>((res, rej) => {
      const r = version ? indexedDB.open("kalimati-voices", version) : indexedDB.open("kalimati-voices");
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("clips")) r.result.createObjectStore("clips");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error("blocked"));
    });
  dbPromise = open().then((db) => {
    if (db.objectStoreNames.contains("clips")) return db;
    const next = db.version + 1;
    db.close();
    return open(next);
  });
  return dbPromise;
}

async function clipTx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((res, rej) => {
    const tx = db.transaction("clips", mode);
    const req = fn(tx.objectStore("clips"));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}

export const putClip = (key: string, blob: Blob) => clipTx<void>("readwrite", (s) => s.put(blob, key));
export const getClip = (key: string) => clipTx<Blob | undefined>("readonly", (s) => s.get(key));
export const delClip = (key: string) => clipTx<void>("readwrite", (s) => s.delete(key));
export const allClipKeys = () => clipTx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

export const clipKey = (word: Word, lang: "en" | "ar") => lang + "|" + word.e;

export async function playClip(key: string): Promise<boolean> {
  try {
    const blob = await getClip(key);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    await new Promise<void>((res) => {
      a.onended = () => res();
      a.onerror = () => res();
      a.play().catch(() => res());
    });
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function sayWord(word: Word, both: boolean, recKeys: Record<string, boolean>) {
  const enKey = clipKey(word, "en");
  const arKey = clipKey(word, "ar");
  const hasEn = !!recKeys[enKey];
  const hasAr = !!recKeys[arKey];

  if (hasEn) await playClip(enKey);
  else speakEn(word.e);

  if (!both) return;
  if (hasAr) {
    if (hasEn) await playClip(arKey);
    else setTimeout(() => playClip(arKey), 900);
  } else if (word.a && hasEn) {
    speakAr(word.a);
  } else if (word.a && !hasEn) {
    speakBoth(word.e, word.a);
  }
}
