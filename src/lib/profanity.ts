// Names and symbols of launch tokens are user-written and unfiltered on
// chain. We hide pools whose name or symbol carries slurs or crude words,
// so the Curves pages do not become a wall of them. Matching is on a
// normalised form (lowercase, leetspeak collapsed, separators removed);
// slurs match anywhere, milder words only as whole words.

const SLURS = [
  "nigg",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "kike",
  "spic",
  "chink",
  "tranny",
  "wetback",
  "raghead",
  "coon",
  "gook",
  "dyke",
  "hitler",
  "nazi",
  "rape",
  "rapist",
  "pedo",
  "paedo",
  "jew",
];

const CRUDE = [
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "asshole",
  "bastard",
  "porn",
  "sex",
  "anal",
  "cum",
  "penis",
  "vagina",
  "tits",
  "boobs",
  "nude",
  "hure",
  "fotze",
  "schwuchtel",
  "arschloch",
  "scheisse",
  "wichser",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-zäöüß]+/g, " ")
    .trim();
}

export function isOffensive(...parts: (string | null | undefined)[]): boolean {
  const text = normalise(parts.filter(Boolean).join(" "));
  if (!text) return false;
  const squashed = text.replace(/\s+/g, "");
  if (SLURS.some((w) => squashed.includes(w))) return true;
  const words = new Set(text.split(" "));
  return CRUDE.some((w) => words.has(w));
}
