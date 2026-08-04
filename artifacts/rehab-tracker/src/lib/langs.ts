export const LANGS = [
  { code: "he-IL", flag: "🇮🇱", label: "Hebrew" },
  { code: "en-US", flag: "🇬🇧", label: "English" },
  { code: "ru-RU", flag: "🇷🇺", label: "Russian" },
] as const;

export type Lang = typeof LANGS[number];
