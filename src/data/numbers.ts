import type { Deck, Word } from "./decks";

const rows: [number, string, string, string][] = [
  [0, "zero", "صِفْر", "sifr"],
  [1, "one", "واحِد", "waahid"],
  [2, "two", "اِثْنان", "ithnaan"],
  [3, "three", "ثَلاثة", "thalaatha"],
  [4, "four", "أَرْبَعة", "arba'a"],
  [5, "five", "خَمْسة", "khamsa"],
  [6, "six", "سِتّة", "sitta"],
  [7, "seven", "سَبْعة", "sab'a"],
  [8, "eight", "ثَمانية", "thamaaniya"],
  [9, "nine", "تِسْعة", "tis'a"],
  [10, "ten", "عَشَرة", "ashara"],
  [11, "eleven", "أَحَدَ عَشَر", "ahada ashar"],
  [12, "twelve", "اِثْنا عَشَر", "ithnaa ashar"],
  [13, "thirteen", "ثَلاثَةَ عَشَر", "thalaathata ashar"],
  [14, "fourteen", "أَرْبَعَةَ عَشَر", "arba'ata ashar"],
  [15, "fifteen", "خَمْسَةَ عَشَر", "khamsata ashar"],
  [16, "sixteen", "سِتَّةَ عَشَر", "sittata ashar"],
  [17, "seventeen", "سَبْعَةَ عَشَر", "sab'ata ashar"],
  [18, "eighteen", "ثَمانِيَةَ عَشَر", "thamaaniyata ashar"],
  [19, "nineteen", "تِسْعَةَ عَشَر", "tis'ata ashar"],
  [20, "twenty", "عِشْرون", "ishroon"],
  [30, "thirty", "ثَلاثون", "thalaathoon"],
  [40, "forty", "أَرْبَعون", "arba'oon"],
  [50, "fifty", "خَمْسون", "khamsoon"],
  [60, "sixty", "سِتّون", "sittoon"],
  [70, "seventy", "سَبْعون", "sab'oon"],
  [80, "eighty", "ثَمانون", "thamaanoon"],
  [90, "ninety", "تِسْعون", "tis'oon"],
  [100, "one hundred", "مِئة", "mi'a"],
];

export const NUMBER_WORDS: Word[] = rows.map(([numberValue, e, a, t]) => ({
  e, a, t, numberValue, m: `the number ${numberValue}`,
}));
export const numberValue = (word: Word) => word.numberValue ?? NUMBER_WORDS.find((n) => n.e === word.e)?.numberValue;
export const arabicDigits = (value: number) => String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit);

export const NUMBER_DECKS: Deck[] = [
  { id: "counting-start", shelf: "numbers", unit: "Numbers 1", title: "Zero to Ten", glyph: "٠–١٠", fill: "#DFF3EA", words: NUMBER_WORDS.filter((w) => (w.numberValue ?? 0) <= 10) },
  { id: "counting-teens", shelf: "numbers", unit: "Numbers 2", title: "Eleven to Twenty", glyph: "١١–٢٠", fill: "#E6EEFB", words: NUMBER_WORDS.filter((w) => (w.numberValue ?? 0) >= 11 && (w.numberValue ?? 0) <= 20) },
  { id: "counting-tens", shelf: "numbers", unit: "Numbers 3", title: "Tens to One Hundred", glyph: "١٠٠", fill: "#FFD9C9", words: NUMBER_WORDS.filter((w) => (w.numberValue ?? 0) >= 10 && (w.numberValue ?? 0) % 10 === 0) },
];