import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import heroPicture from "@/assets/kalimati-hero.jpg";
import {
  ALL,
  DAY_FILLS,
  DECKS,
  DECK_ICONS,
  STORE,
  picFor,
  type Deck,
  type Pic,
  type Word,
} from "@/data/decks";
import {
  allClipKeys,
  chime,
  clipKey,
  delClip,
  fanfare,
  playClip,
  putClip,
  sayWord,
  speakAr,
  speakEn,
} from "./audio";
import { assess, recognitionSupported, listen, scoreColour, type Score } from "./pronunciation";

const SCORE_STORE = "kalimati.scores.v1";

const PRAISE = [
  "Yes! You got it!",
  "Brilliant!",
  "Perfect — well done!",
  "Ooh, nice one!",
  "That is exactly right!",
  "Clever you!",
  "Spot on!",
];
const KIND = [
  "Nearly! Here it is.",
  "Good try — look again.",
  "Almost! This is the one.",
  "Not quite — now you know it.",
  "Close one! Here it is.",
];

const SESSION_LENGTH = 6;
const INK = "#3B322B";

type QMode = "arabic" | "meaning" | "reverse" | "listen" | "spell" | "sentence";
type Question = { word: Word; mode: QMode; options: Word[] };
type GameMode = "mix" | "arabic" | "meaning" | "reverse" | "listen" | "spell" | "sentence";
type Flags = Record<string, boolean>;

const GAME_MODES: { id: GameMode; label: string; icon: string; blurb: string }[] = [
  { id: "mix", label: "Mixed play", icon: "🎲", blurb: "a little of everything" },
  { id: "arabic", label: "Say it in Arabic", icon: "🔤", blurb: "English word → Arabic" },
  { id: "reverse", label: "Read the Arabic", icon: "🔁", blurb: "Arabic → English" },
  { id: "meaning", label: "What does it mean?", icon: "💭", blurb: "pick the meaning" },
  { id: "listen", label: "Listen and find", icon: "👂", blurb: "hear it, then choose" },
  { id: "spell", label: "Spell it out", icon: "🧩", blurb: "build the word from letters" },
  { id: "sentence", label: "Build the sentence", icon: "🧱", blurb: "put the Arabic words in order" },
];

const arabicTokens = (w: Word) => w.a.trim().split(/\s+/).filter(Boolean);

type Progress = {
  known: Flags;
  tricky: Flags;
  fav: Flags;
  week: number[];
  streak: number;
  firstTry: { right: number; total: number };
  lastDay: string | null;
  weekStart: string | null;
  stickers: string[];
};

const emptyProgress = (): Progress => ({
  known: {},
  tricky: {},
  fav: {},
  week: [0, 0, 0, 0, 0, 0, 0],
  streak: 0,
  firstTry: { right: 0, total: 0 },
  lastDay: null,
  weekStart: null,
  stickers: [],
});

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

const dateKey = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => dateKey(new Date());
const dayIndex = () => (new Date().getDay() + 6) % 7;
function mondayOf() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayIndex());
  return dateKey(d);
}

/* ---------------- shared style helpers ---------------- */

const card = (fill: string, radius = 30): CSSProperties => ({
  background: fill,
  border: `3px solid ${INK}`,
  borderRadius: radius,
  boxShadow: `0 6px 0 ${INK}`,
});

const pill = (bg: string, color: string, shadow = INK): CSSProperties => ({
  background: bg,
  color,
  border: `3px solid ${INK}`,
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 4px 0 ${shadow}`,
  minHeight: 46,
});

function picStyle(pic: Pic, size: "lg" | "sm"): CSSProperties {
  const lg = size === "lg";
  const box = lg ? 108 : 52;
  const base: CSSProperties = {
    width: box,
    height: box,
    flex: "0 0 auto",
    border: `3px solid ${INK}`,
    borderRadius: lg ? 30 : 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 ${lg ? 5 : 3}px 0 ${INK}`,
    background: "#FFF6EC",
    overflow: "hidden",
  };
  if (pic.kind === "swatch") return { ...base, background: pic.value };
  if (pic.kind === "num")
    return { ...base, background: "#FFE3A8", fontFamily: "Lora, serif", fontWeight: 600, fontSize: lg ? 52 : 24, lineHeight: 1 };
  if (pic.kind === "letter")
    return { ...base, background: "#FFE3A8", fontFamily: "Lora, serif", fontWeight: 600, fontSize: lg ? 54 : 26, lineHeight: 1, color: "#7C6E60" };
  return { ...base, fontSize: lg ? 58 : 27, lineHeight: 1 };
}

const picText = (pic: Pic) => (pic.kind === "swatch" ? "" : pic.value);

function favBtnStyle(on: boolean, small?: boolean): CSSProperties {
  return {
    ...pill(on ? "#FFE3A8" : "#FFFFFF", INK),
    boxShadow: "none",
    padding: small ? "10px 16px" : "13px 20px",
    fontSize: small ? 14 : 15,
    minHeight: 44,
    whiteSpace: "nowrap",
  };
}

const DECOR = [
  { e: "🎈", top: "6%", left: "3%", size: 42, dur: 7 },
  { e: "🌹", top: "22%", left: "8%", size: 34, dur: 9 },
  { e: "🎈", top: "48%", left: "2%", size: 36, dur: 8 },
  { e: "🌷", top: "72%", left: "7%", size: 32, dur: 10 },
  { e: "🎈", top: "10%", left: "92%", size: 44, dur: 8 },
  { e: "🌹", top: "36%", left: "95%", size: 34, dur: 11 },
  { e: "🎈", top: "62%", left: "91%", size: 38, dur: 9 },
  { e: "🌸", top: "84%", left: "94%", size: 30, dur: 7 },
];

function FloatingDecor() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {DECOR.map((d, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: d.top,
            left: d.left,
            fontSize: d.size,
            opacity: 0.55,
            animation: `floaty ${d.dur}s ease-in-out ${i * 0.4}s infinite`,
          }}
        >
          {d.e}
        </span>
      ))}
    </div>
  );
}


function Mascot({ mood }: { mood: "happy" | "oops" | "waiting" }) {
  const bg = mood === "happy" ? "#FFE3A8" : mood === "oops" ? "#FFFFFF" : "#FFF6EC";
  const face: CSSProperties = {
    width: 78,
    height: 78,
    flex: "0 0 auto",
    borderRadius: 26,
    border: `3px solid ${INK}`,
    background: bg,
    boxShadow: `0 5px 0 ${INK}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    animation: mood === "happy" ? "hop 0.7s ease-out" : mood === "oops" ? "wiggle 0.5s ease-in-out 2" : "floaty 5s ease-in-out infinite",
  };
  const eye: CSSProperties = {
    width: 11,
    height: mood === "happy" ? 5 : 11,
    borderRadius: 999,
    background: INK,
    marginTop: mood === "happy" ? 3 : 0,
  };
  const mouth: CSSProperties =
    mood === "happy"
      ? { width: 34, height: 17, borderBottom: `5px solid ${INK}`, borderRadius: "0 0 999px 999px" }
      : mood === "oops"
        ? { width: 15, height: 15, border: `4px solid ${INK}`, borderRadius: "50%" }
        : { width: 22, height: 5, background: INK, borderRadius: 999 };
  return (
    <div style={face}>
      <div style={{ display: "flex", gap: 13 }}>
        <div style={eye} />
        <div style={eye} />
      </div>
      <div style={mouth} />
    </div>
  );
}

/* ---------------- the app ---------------- */

export default function KalimatiApp() {
  const [screen, setScreen] = useState<"home" | "practice" | "done" | "record">("home");
  const [tab, setTab] = useState<"english" | "science" | "arabic">("english");
  const [deckId, setDeckId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Word | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [earned, setEarned] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("mix");

  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [recKeys, setRecKeys] = useState<Flags>({});
  const [recording, setRecording] = useState<string | null>(null);
  const [recDeckId, setRecDeckId] = useState<string>(DECKS[0]!.id);
  const [micError, setMicError] = useState("");
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [checking, setChecking] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const recTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopListen = useRef<(() => Promise<string>) | null>(null);
  const recStart = useRef(0);
  const loaded = useRef(false);

  /* load + persist */
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || "null") as Partial<Progress> | null;
      if (raw && raw.known) {
        const next = { ...emptyProgress(), ...raw } as Progress;
        if (!Array.isArray(next.stickers)) next.stickers = [];
        const thisWeek = mondayOf();
        if (next.weekStart !== thisWeek) {
          next.week = [0, 0, 0, 0, 0, 0, 0];
          next.weekStart = thisWeek;
        }
        setProgress(next);
      }
    } catch {
      /* ignore */
    }
    try {
      const rawScores = JSON.parse(localStorage.getItem(SCORE_STORE) || "null") as Record<string, Score> | null;
      if (rawScores) setScores(rawScores);
    } catch {
      /* ignore */
    }
    loaded.current = true;
    allClipKeys()
      .then((keys) => {
        const map: Flags = {};
        (keys || []).forEach((k) => {
          map[String(k)] = true;
        });
        setRecKeys(map);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(progress));
    } catch {
      /* ignore */
    }
  }, [progress]);

  const favWords = useMemo(() => ALL.filter((w) => progress.fav[w.e]), [progress.fav]);

  const toggleFav = useCallback((en: string) => {
    setProgress((p) => ({ ...p, fav: { ...p.fav, [en]: !p.fav[en] } }));
  }, []);

  const say = useCallback((w: Word, both: boolean) => void sayWord(w, both, recKeys), [recKeys]);

  /* session building */
  const start = (id: string, requested: GameMode = gameMode) => {
    const len = SESSION_LENGTH;
    let pool: Word[];
    let distractorPool: Word[];
    if (id === "fav") {
      pool = favWords;
      distractorPool = ALL;
    } else {
      const deck = DECKS.find((d) => d.id === id) || DECKS[0]!;
      pool = deck.words;
      distractorPool = deck.words;
    }
    if (requested === "arabic" || requested === "reverse" || requested === "listen") {
      const withArabic = pool.filter((w) => w.a);
      if (withArabic.length >= 4) pool = withArabic;
    }
    if (requested === "sentence") {
      const multi = pool.filter((w) => arabicTokens(w).length >= 2);
      if (multi.length >= 2) pool = multi;
    }
    if (!pool.length) return;
    const MIX: QMode[] = ["arabic", "reverse", "meaning", "listen", "spell", "sentence"];
    const qs: Question[] = shuffle(pool)
      .slice(0, len)
      .map((w, i) => {
        let mode: QMode = requested === "mix" ? MIX[i % MIX.length]! : (requested as QMode);
        if (mode === "sentence" && arabicTokens(w).length < 2) mode = w.a ? "arabic" : "meaning";
        if (!w.a && (mode === "arabic" || mode === "reverse")) mode = "meaning";
        if (!w.a && mode === "listen") mode = "listen";
        if (mode === "spell" && (w.e.replace(/[^a-z]/gi, "").length > 12 || /\s/.test(w.e.trim())))
          mode = arabicTokens(w).length >= 2 ? "sentence" : w.a ? "arabic" : "meaning";
        let others = distractorPool.filter((x) => x.e !== w.e);
        const needArabic = mode === "arabic" || mode === "reverse";
        if (needArabic) others = others.filter((x) => x.a);
        if (others.length < 3) others = ALL.filter((x) => x.e !== w.e && (needArabic ? !!x.a : true));
        return { word: w, mode, options: shuffle([w].concat(shuffle(others).slice(0, 3))) };
      });
    setDeckId(id);
    setQuestions(qs);
    setIdx(0);
    setPicked(null);
    setCorrectCount(0);
    setMissed([]);
    setEarned(null);
    setScreen("practice");
  };

  const q = questions[idx];

  const pick = (opt: Word) => {
    if (picked || !q) return;
    const right = opt.e === q.word.e;
    chime(right);
    setTimeout(() => say(q.word, true), right ? 340 : 420);
    setPicked(opt);
    if (right) setCorrectCount((c) => c + 1);
    else setMissed((m) => m.concat([q.word]));
    setProgress((p) => ({
      ...p,
      known: right ? { ...p.known, [q.word.e]: true } : p.known,
      tricky: right ? p.tricky : { ...p.tricky, [q.word.e]: true },
      firstTry: { right: p.firstTry.right + (right ? 1 : 0), total: p.firstTry.total + 1 },
    }));
  };

  const next = () => {
    const last = idx >= questions.length - 1;
    if (!last) {
      setIdx((i) => i + 1);
      setPicked(null);
      return;
    }
    const done = questions.length;
    const day = today();
    const deck = DECKS.find((d) => d.id === deckId);
    const perfect = correctCount === questions.length;
    const sticker = perfect && deck ? DECK_ICONS[deck.id] || "📘" : null;
    fanfare();
    setProgress((p) => {
      const week = p.week.slice();
      week[dayIndex()] = (week[dayIndex()] || 0) + done;
      let streak = p.streak;
      if (p.lastDay !== day) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        streak = p.lastDay === dateKey(y) ? p.streak + 1 : 1;
      }
      return {
        ...p,
        week,
        streak,
        lastDay: day,
        weekStart: mondayOf(),
        stickers: sticker ? p.stickers.concat([sticker]).slice(-24) : p.stickers,
      };
    });
    setEarned(sticker);
    setPicked(null);
    setScreen("done");
  };

  const resetProgress = () => {
    try {
      localStorage.removeItem(STORE);
    } catch {
      /* ignore */
    }
    setProgress(emptyProgress());
    setConfirmReset(false);
    setScreen("home");
    setDeckId(null);
    setQuestions([]);
  };

  /* recording */
  const stopRec = useCallback(() => {
    if (recTimer.current) clearTimeout(recTimer.current);
    try {
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const startRec = async (key: string, word: Word, lang: "en" | "ar") => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Date.now() - recStart.current;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) {
          await putClip(key, blob);
          setRecKeys((r) => ({ ...r, [key]: true }));
        }
        setRecording(null);
        setMicError("");
        setChecking(key);
        let heardRaw = "";
        try {
          heardRaw = stopListen.current ? await stopListen.current() : "";
        } catch {
          heardRaw = "";
        }
        stopListen.current = null;
        const score = assess({
          expectedRaw: lang === "ar" ? word.a : word.e,
          heardRaw,
          lang,
          durationMs,
          recognised: recognitionSupported(),
        });
        setScores((prev) => {
          const next = { ...prev, [key]: score };
          try {
            localStorage.setItem(SCORE_STORE, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        setChecking(null);
      };
      recorder.current = rec;
      recStart.current = Date.now();
      try {
        stopListen.current = listen(lang);
      } catch {
        stopListen.current = null;
      }
      rec.start();
      setRecording(key);
      setMicError("");
      recTimer.current = setTimeout(() => stopRec(), 8000);
    } catch {
      setMicError("I could not reach the microphone. Allow mic access and try again.");
    }
  };

  const removeClip = async (key: string) => {
    try {
      await delClip(key);
      setScores((prev) => {
        const n = { ...prev };
        delete n[key];
        try {
          localStorage.setItem(SCORE_STORE, JSON.stringify(n));
        } catch {
          /* ignore */
        }
        return n;
      });
      setRecKeys((r) => {
        const n = { ...r };
        delete n[key];
        return n;
      });
    } catch {
      /* ignore */
    }
  };

  /* derived values */
  const learned = Object.keys(progress.known).length;
  const reviewCount = Object.keys(progress.tricky).length;
  const accuracyLabel = progress.firstTry.total
    ? Math.round((progress.firstTry.right / progress.firstTry.total) * 100) + "%"
    : "—";
  const streakLabel = progress.streak ? progress.streak + "-day streak" : "first day";
  const weekTotal = progress.week.reduce((a, b) => a + b, 0);
  const maxWeek = Math.max(...progress.week, 1);
  const recTotal = Object.keys(recKeys).length;
  const total = questions.length || 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "Nunito, system-ui, sans-serif",
        color: INK,
        padding: "28px 20px 64px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#FFF6EC",
        backgroundImage: "radial-gradient(#F3E2CE 1.5px, transparent 1.6px)",
        backgroundSize: "26px 26px",
        position: "relative",
      }}
    >
      <FloatingDecor />
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 1 }}>
        {/* header */}
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              dir="rtl"
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: "#FFE3A8",
                border: `3px solid ${INK}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Noto Naskh Arabic', serif",
                fontSize: 24,
                fontWeight: 700,
                boxShadow: `0 4px 0 ${INK}`,
                animation: "floaty 5s ease-in-out infinite",
              }}
            >
              كَ
            </div>
            <div>
              <h1 style={{ fontFamily: "Lora, serif", fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
                Kalimati — my words
              </h1>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>
                Built by: Halim Faroug A. Elhag
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#FFFFFF",
              border: `3px solid ${INK}`,
              borderRadius: 999,
              padding: "8px 16px",
              boxShadow: `0 4px 0 ${INK}`,
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#EE7A56" }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>{streakLabel}</span>
          </div>
        </header>

        {/* ---------- home ---------- */}
        {screen === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "popIn 0.35s ease-out" }}>
            <section style={{ ...card("#FFFFFF"), padding: 26, display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 30, fontWeight: 600, lineHeight: 1.15 }}>
                  Sit together and pick a little book.
                </div>
                <div style={{ fontSize: 16, color: "#7C6E60", lineHeight: 1.5 }}>
                  Say each English word out loud, choose the matching Arabic, then hear it read back. Star the ones worth
                  keeping.
                </div>
              </div>
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  className="k-press"
                  onClick={() => start(DECKS[0]!.id)}
                  style={{ ...pill("#EE7A56", "#FFFFFF"), padding: "18px 34px", fontSize: 19, boxShadow: `0 6px 0 ${INK}`, minHeight: 48 }}
                >
                  Start practice
                </button>
                <button
                  className="k-press"
                  onClick={() => {
                    setMicError("");
                    setScreen("record");
                  }}
                  style={{ ...pill("#FFFFFF", INK), padding: "14px 28px", fontSize: 16, boxShadow: `0 5px 0 ${INK}` }}
                >
                  🎙️ {recTotal ? `Our voices (${recTotal})` : "Record our voices"}
                </button>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
              {[
                { v: learned, label: "Words known", fill: "#DFF3EA", color: "#46705E" },
                { v: accuracyLabel, label: "First try", fill: "#E6EEFB", color: "#43628A" },
                { v: reviewCount, label: "Still tricky", fill: "#FFE9CC", color: "#86653A" },
                { v: favWords.length, label: "Starred", fill: "#FFD9C9", color: "#8C5540" },
              ].map((s) => (
                <div key={s.label} style={{ ...card(s.fill, 24), padding: "18px 20px", boxShadow: `0 5px 0 ${INK}` }}>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{s.v}</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: s.color,
                      marginTop: 4,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </section>

            {/* sticker book */}
            <section style={{ ...card("#FFFFFF"), padding: "22px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 600 }}>My sticker book</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9A8A7B" }}>
                  {progress.stickers.length
                    ? `${progress.stickers.length} ${progress.stickers.length === 1 ? "sticker" : "stickers"} earned`
                    : "win a whole round to earn one"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {progress.stickers
                  .concat(new Array(Math.max(0, 8 - progress.stickers.length)).fill(null))
                  .slice(0, Math.max(8, progress.stickers.length))
                  .map((mark: string | null, i) => (
                    <div
                      key={i}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 27,
                        lineHeight: 1,
                        border: mark ? `3px solid ${INK}` : "3px dashed #E0CDB4",
                        background: mark ? "#FFE3A8" : "#FFFBF4",
                        boxShadow: mark ? `0 3px 0 ${INK}` : "none",
                        animation: mark && i === progress.stickers.length - 1 ? "bounceIn 0.5s ease-out" : "none",
                      }}
                    >
                      {mark || ""}
                    </div>
                  ))}
              </div>

              {(progress.firstTry.total || progress.stickers.length || learned) > 0 && (
                <div style={{ borderTop: "2px dashed #EADCC9", paddingTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {confirmReset ? (
                    <>
                      <div style={{ flex: "1 1 220px", minWidth: 0, fontSize: 15, fontWeight: 700, color: "#6E6055" }}>
                        Clear the streak, stars and stickers? Recorded voices are kept.
                      </div>
                      <button onClick={resetProgress} style={{ ...pill("#FFC9B8", INK), padding: "12px 22px", fontSize: 15 }}>
                        Yes, start over
                      </button>
                      <button onClick={() => setConfirmReset(false)} style={{ ...pill("#FFFFFF", INK), padding: "12px 22px", fontSize: 15 }}>
                        Keep it
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          flex: "1 1 220px",
                          minWidth: 0,
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#B6A695",
                        }}
                      >
                        Grown-ups
                      </div>
                      <button
                        onClick={() => setConfirmReset(true)}
                        style={{
                          background: "#FFFFFF",
                          color: "#6E6055",
                          border: "3px solid #E0CDB4",
                          borderRadius: 999,
                          padding: "11px 20px",
                          fontSize: 14,
                          fontWeight: 800,
                          cursor: "pointer",
                          minHeight: 44,
                        }}
                      >
                        Start over
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* week chart */}
            <section style={{ ...card("#FFFFFF"), padding: "24px 26px" }}>
              <div
                style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}
              >
                <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 600 }}>This week together</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9A8A7B" }}>
                  {weekTotal ? `${weekTotal} words practiced` : "nothing yet — start a book below"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 132 }}>
                {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
                  <div key={i} style={{ flex: "1 1 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#9A8A7B" }}>{progress.week[i] || ""}</div>
                    <div
                      style={{
                        width: "100%",
                        border: `3px solid ${INK}`,
                        borderRadius: "12px 12px 6px 6px",
                        background: progress.week[i] ? DAY_FILLS[i] : "#F6ECDD",
                        height: Math.max(8, Math.round(((progress.week[i] || 0) / maxWeek) * 92)),
                      }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 800, color: i === dayIndex() ? INK : "#B6A695" }}>{label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* game modes */}
            <section style={{ ...card("#FFFFFF"), padding: "22px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 600 }}>Choose a game</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9A8A7B" }}>then pick a little book below</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                {GAME_MODES.map((m) => {
                  const on = gameMode === m.id;
                  return (
                    <button
                      key={m.id}
                      className="k-press"
                      onClick={() => setGameMode(m.id)}
                      style={{
                        ...card(on ? "#FFE3A8" : "#FFFBF4", 20),
                        border: `3px solid ${on ? INK : "#E0CDB4"}`,
                        boxShadow: on ? `0 5px 0 ${INK}` : "none",
                        padding: "14px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        color: INK,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minHeight: 64,
                      }}
                    >
                      <span style={{ fontSize: 24, lineHeight: 1 }}>{m.icon}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{m.label}</span>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#7C6E60", marginTop: 2 }}>{m.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* shelves + decks */}
            <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(
                  [
                    ["english", "English book"],
                    ["science", "Science book"],
                    ["arabic", "Arabic book"],
                  ] as const
                ).map(([id, label]) => {
                  const on = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      style={{
                        ...pill(on ? INK : "#FFFFFF", on ? "#FFF6EC" : INK, on ? "#A08E7C" : INK),
                        padding: "12px 24px",
                        fontSize: 16,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {(favWords.length
                  ? [
                      {
                        id: "fav",
                        title: "★ My starred words",
                        glyph: "كَلِماتي",
                        fill: "#FFE3A8",
                        icon: "⭐",
                        sub: `${favWords.length} ${favWords.length === 1 ? "word" : "words"}`,
                        pct: Math.round((favWords.filter((w) => progress.known[w.e]).length / favWords.length) * 100),
                        progressLabel: "the ones you chose to keep",
                      },
                    ]
                  : []
                )
                  .concat(
                    DECKS.filter((d: Deck) => d.shelf === tab).map((d) => {
                      const done = d.words.filter((w) => progress.known[w.e]).length;
                      return {
                        id: d.id,
                        title: d.title,
                        glyph: d.glyph,
                        fill: d.fill,
                        icon: DECK_ICONS[d.id] || "📘",
                        sub: `${d.words.length} words`,
                        pct: Math.round((done / d.words.length) * 100),
                        progressLabel: `${done} of ${d.words.length} known`,
                      };
                    }),
                  )
                  .map((d) => (
                    <button
                      key={d.id}
                      className="k-press"
                      onClick={() => start(d.id)}
                      style={{
                        ...card(d.fill, 26),
                        boxShadow: `0 5px 0 ${INK}`,
                        textAlign: "left",
                        cursor: "pointer",
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                        color: INK,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div
                          style={{
                            width: 46,
                            height: 46,
                            flex: "0 0 auto",
                            border: `3px solid ${INK}`,
                            borderRadius: 15,
                            background: "#FFF6EC",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            lineHeight: 1,
                            boxShadow: `0 3px 0 ${INK}`,
                          }}
                        >
                          {d.icon}
                        </div>
                        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                          <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 600, lineHeight: 1.15 }}>{d.title}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#6E6055", marginTop: 3 }}>{d.sub}</div>
                        </div>
                        <div
                          dir="rtl"
                          style={{
                            fontFamily: "'Noto Naskh Arabic', serif",
                            fontSize: 22,
                            fontWeight: 700,
                            opacity: 0.5,
                            lineHeight: 1.6,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.glyph}
                        </div>
                      </div>
                      <div>
                        <div style={{ height: 14, border: `3px solid ${INK}`, borderRadius: 999, background: "#FFFFFF", overflow: "hidden" }}>
                          <div style={{ height: "100%", background: INK, width: `${d.pct}%` }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, marginTop: 7, color: "#6E6055" }}>{d.progressLabel}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          </div>
        )}

        {/* ---------- record ---------- */}
        {screen === "record" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "popIn 0.35s ease-out" }}>
            <section style={{ ...card("#FFFFFF"), padding: "24px 26px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 28, fontWeight: 600, lineHeight: 1.15 }}>Our own voices</div>
                <div style={{ fontSize: 16, color: "#7C6E60", lineHeight: 1.5 }}>
                  Tap the red dot and say the word out loud. Whatever you record is what the app will play from then on — a
                  real voice beats a robot every time.
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#46705E" }}>
                  {recTotal
                    ? `${recTotal} ${recTotal === 1 ? "recording" : "recordings"} saved — they play instead of the robot voice`
                    : "Nothing recorded yet — start with a word you both know"}
                </div>
              </div>
              <button
                onClick={() => {
                  stopRec();
                  setMicError("");
                  setScreen("home");
                }}
                style={{ ...pill(INK, "#FFF6EC", "#A08E7C"), flex: "0 0 auto", padding: "15px 28px", fontSize: 16, boxShadow: "0 5px 0 #A08E7C" }}
              >
                Done
              </button>
            </section>

            {micError && (
              <div style={{ ...card("#FFC9B8", 22), padding: "16px 20px", boxShadow: `0 4px 0 ${INK}`, fontSize: 16, fontWeight: 700 }}>
                {micError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {DECKS.map((d) => {
                const on = d.id === recDeckId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setRecDeckId(d.id)}
                    style={{
                      ...pill(on ? INK : "#FFFFFF", on ? "#FFF6EC" : INK, on ? "#A08E7C" : INK),
                      padding: "10px 18px",
                      fontSize: 14,
                      minHeight: 44,
                    }}
                  >
                    {(DECK_ICONS[d.id] || "📘") + "  " + d.title}
                  </button>
                );
              })}
            </div>

            <section style={{ ...card("#FFFFFF"), padding: "20px 24px", display: "flex", flexDirection: "column" }}>
              {(DECKS.find((d) => d.id === recDeckId) || DECKS[0]!).words.map((w) => {
                const pic = picFor(w);
                const slots: Array<{ tag: string; lang: "en" | "ar" }> = [{ tag: "EN", lang: "en" }];
                if (w.a) slots.push({ tag: "AR", lang: "ar" });
                return (
                  <div key={w.e} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: "2px dashed #EADCC9", flexWrap: "wrap" }}>
                    <div style={picStyle(pic, "sm")}>{picText(pic)}</div>
                    <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 600 }}>{w.e}</div>
                      <div dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: 22, fontWeight: 700, lineHeight: 1.6, color: "#6E6055" }}>
                        {w.a}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {slots.map((sl) => {
                        const key = clipKey(w, sl.lang);
                        const has = !!recKeys[key];
                        const live = recording === key;
                        return (
                          <div
                            key={sl.tag}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flex: "0 0 auto",
                              border: `3px solid ${INK}`,
                              borderRadius: 999,
                              padding: "6px 8px 6px 14px",
                              background: live ? "#FFC9B8" : has ? "#DFF3EA" : "#FFFBF4",
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em" }}>{sl.tag}</span>
                            <button
                              aria-label={live ? `Stop recording ${w.e}` : `Record ${w.e} in ${sl.tag}`}
                              onClick={() => (live ? stopRec() : startRec(key, w, sl.lang))}
                              style={{
                                width: 46,
                                height: 46,
                                flex: "0 0 auto",
                                borderRadius: "50%",
                                cursor: "pointer",
                                border: `3px solid ${INK}`,
                                fontSize: live ? 14 : 18,
                                lineHeight: 1,
                                background: live ? INK : "#FFFFFF",
                                color: live ? "#FFF6EC" : "#D8452A",
                                animation: live ? "sparkle 1s ease-in-out infinite" : "none",
                              }}
                            >
                              {live ? "■" : "●"}
                            </button>
                            {has && (
                              <>
                                <button
                                  aria-label={`Play recording of ${w.e}`}
                                  onClick={() => void playClip(key)}
                                  style={{ width: 46, height: 46, flex: "0 0 auto", borderRadius: "50%", border: `3px solid ${INK}`, background: "#DFF3EA", cursor: "pointer", fontSize: 16, color: INK }}
                                >
                                  ▶
                                </button>
                                <button
                                  aria-label={`Delete recording of ${w.e}`}
                                  onClick={() => void removeClip(key)}
                                  style={{ width: 46, height: 46, flex: "0 0 auto", borderRadius: "50%", border: `3px solid ${INK}`, background: "#FFFFFF", cursor: "pointer", fontSize: 16, fontWeight: 800, color: INK }}
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ flex: "1 1 100%", display: "flex", flexDirection: "column", gap: 10 }}>
                      {slots.map((sl) => {
                        const key = clipKey(w, sl.lang);
                        if (checking === key)
                          return (
                            <div key={sl.tag + "-check"} style={{ ...card("#FFF6EC", 18), padding: "12px 16px", boxShadow: `0 3px 0 ${INK}`, fontSize: 15, fontWeight: 700 }}>
                              Listening back to your {sl.lang === "ar" ? "Arabic" : "English"}…
                            </div>
                          );
                        const sc = scores[key];
                        if (!sc) return null;
                        return (
                          <ScorePanel
                            key={sl.tag + "-score"}
                            score={sc}
                            word={w}
                            lang={sl.lang}
                            onPlayMine={() => void playClip(key)}
                            onPlayModel={() => (sl.lang === "ar" ? speakAr(w.a) : speakEn(w.e))}
                            onRetry={() => void startRec(key, w, sl.lang)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* ---------- practice ---------- */}
        {screen === "practice" && q && (
          <PracticeScreen
            q={q}
            idx={idx}
            total={total}
            picked={picked}
            deckName={deckId === "fav" ? "My starred words" : DECKS.find((d) => d.id === deckId)?.title || ""}
            fav={!!progress.fav[q.word.e]}
            onQuit={() => {
              setPicked(null);
              setScreen("home");
            }}
            onPick={pick}
            onNext={next}
            onFav={() => toggleFav(q.word.e)}
            onSay={say}
          />
        )}

        {/* ---------- done ---------- */}
        {screen === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "popIn 0.35s ease-out" }}>
            <section style={{ ...card("#FFE3A8", 32), padding: "34px 26px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 44, letterSpacing: 8, animation: "bounceIn 0.5s ease-out" }}>
                {"★".repeat(Math.max(1, Math.round((correctCount / total) * 3)))}
              </div>
              {earned && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: "#FFFFFF",
                    border: `3px solid ${INK}`,
                    borderRadius: 22,
                    padding: "12px 20px",
                    boxShadow: `0 4px 0 ${INK}`,
                    animation: "bounceIn 0.5s ease-out 0.2s backwards",
                  }}
                >
                  <div style={{ fontSize: 40, lineHeight: 1, animation: "sparkle 1.4s ease-in-out infinite" }}>{earned}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, textAlign: "left" }}>A new sticker for your book!</div>
                </div>
              )}
              <div style={{ fontFamily: "Lora, serif", fontSize: 36, fontWeight: 600, lineHeight: 1.1 }}>
                {correctCount === total ? "Every single one! 🎉" : "Nice work, you two."}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#6E6055" }}>{correctCount} of {total} on the first try</div>
            </section>

            <section style={{ ...card("#FFFFFF"), padding: "24px 26px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 600, marginBottom: 6 }}>
                {missed.length ? "Words to whisper again tomorrow" : "Nothing to review — say these once more for fun"}
              </div>
              {(missed.length ? missed : questions.slice(0, 3).map((x) => x.word)).map((w) => {
                const pic = picFor(w);
                const on = !!progress.fav[w.e];
                return (
                  <div key={w.e} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: "2px dashed #EADCC9", flexWrap: "wrap" }}>
                    <div style={picStyle(pic, "sm")}>{picText(pic)}</div>
                    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 600 }}>{w.e}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#7C6E60" }}>{w.m}</div>
                    </div>
                    <div dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: 26, fontWeight: 700, lineHeight: 1.5 }}>{w.a}</div>
                    <div style={{ fontSize: 15, fontStyle: "italic", fontWeight: 700, color: "#7C6E60", minWidth: 90 }}>{w.t}</div>
                    <button onClick={() => toggleFav(w.e)} style={favBtnStyle(on, true)}>{on ? "★ Starred" : "☆ Star it"}</button>
                    <button
                      onClick={() => say(w, true)}
                      style={{ ...pill("#DFF3EA", INK), boxShadow: "none", padding: "10px 16px", fontSize: 14, minHeight: 44 }}
                    >
                      Say it
                    </button>
                  </div>
                );
              })}
            </section>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button
                className="k-press"
                onClick={() => start(deckId || DECKS[0]!.id)}
                style={{ ...pill("#EE7A56", "#FFFFFF"), flex: "1 1 200px", padding: "17px 28px", fontSize: 18, boxShadow: `0 6px 0 ${INK}`, minHeight: 48 }}
              >
                Practice again
              </button>
              <button
                className="k-press"
                onClick={() => setScreen("home")}
                style={{ ...pill("#FFFFFF", INK), flex: "1 1 200px", padding: "17px 28px", fontSize: 18, boxShadow: `0 6px 0 ${INK}`, minHeight: 48 }}
              >
                Back to the books
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- practice screen ---------------- */

const WRONG: Word = { e: "__wrong__", a: "", t: "", m: "" };

function SentenceBoard({
  word,
  picked,
  onPick,
}: {
  word: Word;
  picked: Word | null;
  onPick: (w: Word) => void;
}) {
  const target = word.a.trim();
  const parts = useMemo(() => shuffle(target.split(/\s+/).map((ch, i) => ({ ch, i }))), [target]);
  const [built, setBuilt] = useState<{ ch: string; i: number }[]>([]);

  useEffect(() => {
    setBuilt([]);
  }, [target]);

  const used = new Set(built.map((b) => b.i));
  const done = !!picked;

  const check = () => {
    if (done) return;
    const attempt = built.map((b) => b.ch).join(" ");
    onPick(attempt === target ? word : WRONG);
  };

  const chip = (bg: string): CSSProperties => ({
    padding: "10px 16px",
    borderRadius: 18,
    border: `3px solid ${INK}`,
    background: bg,
    boxShadow: `0 4px 0 ${INK}`,
    fontSize: 26,
    fontWeight: 700,
    color: INK,
    cursor: done ? "default" : "pointer",
    fontFamily: "'Noto Naskh Arabic', serif",
    lineHeight: 1.6,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <div
        dir="rtl"
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          minHeight: 66,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 20,
          border: "3px dashed #E0CDB4",
          background: "#FFFBF4",
          alignItems: "center",
        }}
      >
        {built.length === 0 && (
          <span style={{ fontSize: 15, fontWeight: 700, color: "#B6A695", fontFamily: "Lora, serif" }}>
            Tap the Arabic words in order
          </span>
        )}
        {built.map((b, n) => (
          <button key={`${b.i}-${n}`} onClick={() => !done && setBuilt((cur) => cur.filter((_, k) => k !== n))} style={chip("#FFE3A8")}>
            {b.ch}
          </button>
        ))}
      </div>

      <div dir="rtl" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {parts.map((p) => (
          <button
            key={p.i}
            disabled={used.has(p.i) || done}
            onClick={() => setBuilt((cur) => cur.concat([p]))}
            style={{ ...chip("#FFFFFF"), opacity: used.has(p.i) ? 0.3 : 1 }}
          >
            {p.ch}
          </button>
        ))}
      </div>

      {!done && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => setBuilt([])} style={{ ...pill("#FFFFFF", INK), padding: "12px 22px", fontSize: 15 }}>
            Clear
          </button>
          <button
            onClick={check}
            disabled={!built.length}
            style={{ ...pill(INK, "#FFF6EC", "#A08E7C"), padding: "12px 26px", fontSize: 16, opacity: built.length ? 1 : 0.5 }}
          >
            Check it
          </button>
        </div>
      )}
    </div>
  );
}

function SpellBoard({
  word,
  picked,
  onPick,
}: {
  word: Word;
  picked: Word | null;
  onPick: (w: Word) => void;
}) {
  const target = word.e;
  const letters = useMemo(() => shuffle(target.split("").map((ch, i) => ({ ch, i }))), [target]);
  const [built, setBuilt] = useState<{ ch: string; i: number }[]>([]);

  useEffect(() => {
    setBuilt([]);
  }, [target]);

  const used = new Set(built.map((b) => b.i));
  const done = !!picked;
  const attempt = built.map((b) => b.ch).join("");

  const check = () => {
    if (done) return;
    onPick(attempt.toLowerCase() === target.toLowerCase() ? word : WRONG);
  };

  const tile = (bg: string): CSSProperties => ({
    minWidth: 46,
    minHeight: 52,
    padding: "8px 10px",
    borderRadius: 16,
    border: `3px solid ${INK}`,
    background: bg,
    boxShadow: `0 4px 0 ${INK}`,
    fontSize: 24,
    fontWeight: 800,
    color: INK,
    cursor: done ? "default" : "pointer",
    fontFamily: "Lora, serif",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          minHeight: 62,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 20,
          border: "3px dashed #E0CDB4",
          background: "#FFFBF4",
          alignItems: "center",
        }}
      >
        {built.length === 0 && <span style={{ fontSize: 15, fontWeight: 700, color: "#B6A695" }}>Tap the letters in order</span>}
        {built.map((b, n) => (
          <button
            key={`${b.i}-${n}`}
            onClick={() => !done && setBuilt((cur) => cur.filter((_, k) => k !== n))}
            style={tile("#FFE3A8")}
          >
            {b.ch === " " ? "␣" : b.ch}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {letters.map((l) => (
          <button
            key={l.i}
            disabled={used.has(l.i) || done}
            onClick={() => setBuilt((cur) => cur.concat([l]))}
            style={{ ...tile("#FFFFFF"), opacity: used.has(l.i) ? 0.3 : 1 }}
          >
            {l.ch === " " ? "␣" : l.ch}
          </button>
        ))}
      </div>

      {!done && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => setBuilt([])} style={{ ...pill("#FFFFFF", INK), padding: "12px 22px", fontSize: 15 }}>
            Clear
          </button>
          <button
            onClick={check}
            disabled={!built.length}
            style={{ ...pill(INK, "#FFF6EC", "#A08E7C"), padding: "12px 26px", fontSize: 16, opacity: built.length ? 1 : 0.5 }}
          >
            Check it
          </button>
        </div>
      )}
    </div>
  );
}

function PracticeScreen({
  q,
  idx,
  total,
  picked,
  deckName,
  fav,
  onQuit,
  onPick,
  onNext,
  onFav,
  onSay,
}: {
  q: Question;
  idx: number;
  total: number;
  picked: Word | null;
  deckName: string;
  fav: boolean;
  onQuit: () => void;
  onPick: (w: Word) => void;
  onNext: () => void;
  onFav: () => void;
  onSay: (w: Word, both: boolean) => void;
}) {
  const w = q.word;
  const right = !!picked && picked.e === w.e;
  const mode = q.mode;
  const arabicOptions = mode === "arabic";
  const englishOptions = mode === "reverse" || mode === "listen";
  const spellMode = mode === "spell";
  const sentenceMode = mode === "sentence";
  const pic = picFor(w);

  useEffect(() => {
    if (mode === "listen") {
      const t = setTimeout(() => onSay(w, false), 320);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.e, mode]);

  const taskLabel =
    mode === "arabic"
      ? "how do you say it in Arabic"
      : mode === "reverse"
        ? "read the Arabic — which word is it"
        : mode === "listen"
          ? "listen, then find the word"
          : mode === "spell"
            ? "build the word, letter by letter"
            : mode === "sentence"
              ? "put the Arabic words in order"
              : "what does it mean";

  const optionStyle = (opt: Word): CSSProperties => {
    const base: CSSProperties = {
      cursor: picked ? "default" : "pointer",
      textAlign: "center",
      minHeight: 108,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      border: `3px solid ${INK}`,
      borderRadius: 26,
      padding: "18px 16px",
      color: INK,
      background: "#FFFFFF",
      boxShadow: `0 5px 0 ${INK}`,
      transition: "transform 0.12s ease",
    };
    if (!picked) return base;
    if (opt.e === w.e) return { ...base, background: "#BCE8D3", transform: "translateY(2px)", boxShadow: `0 3px 0 ${INK}` };
    if (opt.e === picked.e) return { ...base, background: "#FFC9B8", animation: "nudge 0.3s ease" };
    return { ...base, opacity: 0.45 };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          aria-label="Quit practice"
          onClick={onQuit}
          style={{ flex: "0 0 auto", width: 46, height: 46, borderRadius: "50%", border: `3px solid ${INK}`, background: "#FFFFFF", cursor: "pointer", fontSize: 20, fontWeight: 800, color: INK, boxShadow: `0 4px 0 ${INK}` }}
        >
          ×
        </button>
        <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {Array.from({ length: total }).map((_, i) => {
            const doneStep = i < idx || (i === idx && !!picked);
            const current = i === idx && !picked;
            return (
              <div
                key={i}
                style={{
                  flex: "1 1 18px",
                  minWidth: 18,
                  height: 30,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  lineHeight: 1,
                  color: INK,
                  border: `3px solid ${doneStep || current ? INK : "#E0CDB4"}`,
                  background: doneStep ? "#FFE3A8" : current ? "#FFFFFF" : "#FFFBF4",
                  boxShadow: doneStep || current ? `0 3px 0 ${INK}` : "none",
                  animation: current ? "sparkle 1.6s ease-in-out infinite" : "none",
                }}
              >
                {doneStep ? "★" : ""}
              </div>
            );
          })}
        </div>
        <div style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 800, color: "#7C6E60" }}>{idx + 1} / {total}</div>
      </div>

      <section style={{ ...card("#FFFFFF", 32), padding: "30px 26px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9A8A7B" }}>
          {deckName} · {taskLabel}
        </div>

        {mode === "listen" ? (
          <div style={{ ...picStyle({ kind: "emoji", value: "🎧" }, "lg"), background: "#E6EEFB" }}>🎧</div>
        ) : (
          <div style={{ position: "relative" }}>
            <div style={picStyle(pic, "lg")}>{picText(pic)}</div>
            {picked && right && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {[
                  { s: 26, x: "-74px", y: "-58px", d: "0s", c: "⭐" },
                  { s: 22, x: "76px", y: "-50px", d: "0.04s", c: "✨" },
                  { s: 24, x: "-84px", y: "40px", d: "0.08s", c: "🎉" },
                  { s: 20, x: "82px", y: "46px", d: "0.02s", c: "⭐" },
                  { s: 22, x: "0px", y: "-86px", d: "0.06s", c: "✨" },
                ].map((b, i) => (
                  <span
                    key={i}
                    style={{
                      position: "absolute",
                      fontSize: b.s,
                      ["--bx" as string]: b.x,
                      ["--by" as string]: b.y,
                      animation: `burst 0.75s ease-out ${b.d} forwards`,
                    }}
                  >
                    {b.c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "reverse" ? (
          <>
            <div dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: 46, fontWeight: 700, lineHeight: 1.5 }}>{w.a}</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontStyle: "italic", color: "#7C6E60" }}>{w.t}</div>
          </>
        ) : mode === "listen" ? (
          <div style={{ fontFamily: "Lora, serif", fontSize: 44, fontWeight: 600, lineHeight: 1.05 }}>
            {picked ? w.e : "? ? ?"}
          </div>
        ) : (
          <div style={{ fontFamily: "Lora, serif", fontSize: 52, fontWeight: 600, lineHeight: 1.05 }}>
            {spellMode && !picked ? w.m : w.e}
          </div>
        )}

        <div style={{ fontSize: 17, color: "#6E6055", fontWeight: 600, maxWidth: 520 }}>
          {mode === "arabic"
            ? w.m
            : mode === "reverse"
              ? "Say the Arabic out loud, then pick the English word."
              : mode === "listen"
                ? "Tap the ear to hear it again, then choose the word you heard."
                : spellMode
                  ? "Spell the English word for this picture."
                  : sentenceMode
                    ? "Put the Arabic words in the right order to say this."
                    : "Read it together, then pick what it means."}
        </div>

        <button
          className="k-press"
          onClick={() => onSay(w, mode === "reverse")}
          style={{ ...pill("#E6EEFB", INK), padding: "11px 20px", fontSize: 15, minHeight: 44, marginTop: 2 }}
        >
          {mode === "listen"
            ? "👂 Hear it again"
            : mode === "reverse"
              ? "Hear the Arabic"
              : sentenceMode
                ? "Hear it in English"
                : "Hear the English word"}
        </button>
      </section>

      {spellMode ? (
        <SpellBoard word={w} picked={picked} onPick={onPick} />
      ) : sentenceMode ? (
        <SentenceBoard word={w} picked={picked} onPick={onPick} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {q.options.map((o) => (
            <button key={o.e} onClick={() => onPick(o)} style={optionStyle(o)}>
              {englishOptions && <div style={{ fontSize: 30, lineHeight: 1 }}>{picText(picFor(o))}</div>}
              <div
                dir={arabicOptions ? "rtl" : "ltr"}
                style={
                  arabicOptions
                    ? { fontFamily: "'Noto Naskh Arabic', serif", fontSize: 34, fontWeight: 700, lineHeight: 1.5 }
                    : englishOptions
                      ? { fontFamily: "Lora, serif", fontSize: 24, fontWeight: 600, lineHeight: 1.2 }
                      : { fontSize: 16, fontWeight: 700, lineHeight: 1.4 }
                }
              >
                {arabicOptions ? o.a : englishOptions ? o.e : o.m}
              </div>
              {arabicOptions && <div style={{ fontSize: 15, fontWeight: 700, fontStyle: "italic", color: "#7C6E60" }}>{o.t}</div>}
            </button>
          ))}
        </div>
      )}

      {picked && (
        <div
          style={{
            ...card(right ? "#BCE8D3" : "#FFC9B8", 26),
            boxShadow: `0 5px 0 ${INK}`,
            padding: "20px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            animation: "popIn 0.25s ease-out",
          }}
        >
          <Mascot mood={right ? "happy" : "oops"} />
          <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 600 }}>
              {right ? PRAISE[idx % PRAISE.length] : KIND[idx % KIND.length]}
            </div>
            {!!w.a && (
              <div dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: 30, fontWeight: 700, lineHeight: 1.5 }}>{w.a}</div>
            )}
            <div style={{ fontSize: 16, fontWeight: 600, color: "#4E443B" }}>
              {w.a ? `Say it together: ${w.t} — "${w.e}" means ${w.m}.` : `"${w.e}" means ${w.m}.`}
            </div>
          </div>
          <button onClick={onFav} style={favBtnStyle(fav)}>{fav ? "★ Starred" : "☆ Star it"}</button>
          <button onClick={() => onSay(w, true)} style={{ ...pill("#FFFFFF", INK), padding: "13px 20px", fontSize: 15 }}>
            Hear it
          </button>
          <button onClick={onNext} style={{ ...pill(INK, "#FFF6EC", "#A08E7C"), padding: "13px 26px", fontSize: 16 }}>
            {idx >= total - 1 ? "Finish" : "Next word"}
          </button>
        </div>
      )}
    </div>
  );
}


/* ---------- pronunciation score panel ---------- */

function ScorePanel({
  score,
  word,
  lang,
  onPlayMine,
  onPlayModel,
  onRetry,
}: {
  score: Score;
  word: Word;
  lang: "en" | "ar";
  onPlayMine: () => void;
  onPlayModel: () => void;
  onRetry: () => void;
}) {
  const fill = scoreColour(score.percent);
  const btn: CSSProperties = {
    border: `3px solid ${INK}`,
    borderRadius: 999,
    background: "#FFFFFF",
    color: INK,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    minHeight: 44,
    fontFamily: "inherit",
  };
  return (
    <div style={{ ...card(fill, 20), padding: "16px 18px", boxShadow: `0 4px 0 ${INK}`, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div
          aria-hidden
          style={{
            width: 68,
            height: 68,
            flex: "0 0 auto",
            borderRadius: "50%",
            border: `4px solid ${INK}`,
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Lora, serif",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {score.percent}%
        </div>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>
            {score.grade} <span aria-hidden>{"★".repeat(score.stars) + "☆".repeat(3 - score.stars)}</span>
          </div>
          <div style={{ fontSize: 14, color: "#6E6055", fontWeight: 700 }}>
            {lang === "ar" ? "Arabic" : "English"} · {score.recognised ? `heard "${score.heard}"` : "sound check only"}
          </div>
          <div
            role="img"
            aria-label={`Pronunciation accuracy ${score.percent} percent, ${score.grade}`}
            style={{ marginTop: 8, height: 14, borderRadius: 999, border: `3px solid ${INK}`, background: "#FFFFFF", overflow: "hidden" }}
          >
            <div style={{ width: `${score.percent}%`, height: "100%", background: INK, transition: "width 0.5s ease-out" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} dir={lang === "ar" ? "rtl" : "ltr"}>
        {score.parts.map((part, i) => (
          <span
            key={i + part.text}
            style={{
              border: `3px solid ${INK}`,
              borderRadius: 12,
              padding: "4px 10px",
              background: part.ok ? "#FFFFFF" : "#FFD9C9",
              fontFamily: lang === "ar" ? "'Noto Naskh Arabic', serif" : "Lora, serif",
              fontSize: lang === "ar" ? 20 : 16,
              fontWeight: 700,
              opacity: part.ok ? 1 : 0.9,
            }}
          >
            {part.text}
            <span aria-hidden style={{ fontSize: 12, marginLeft: 6 }}>{part.ok ? "✓" : "•"}</span>
          </span>
        ))}
      </div>

      <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
        {score.tips.map((tip) => (
          <li key={tip} style={{ fontSize: 15, lineHeight: 1.5, color: "#4C4038" }}>
            {tip}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onPlayMine} style={btn}>
          ▶ My recording
        </button>
        <button onClick={onPlayModel} style={{ ...btn, background: "#E6EEFB" }}>
          ▶ Model voice{lang === "ar" ? " (Arabic)" : ""}
        </button>
        <button onClick={onRetry} style={{ ...btn, background: INK, color: "#FFF6EC" }}>
          ↻ Try again
        </button>
      </div>
      <span style={{ display: "none" }}>{word.e}</span>
    </div>
  );
}
